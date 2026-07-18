import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const startManagedServers = process.env.PLAYWRIGHT_START_SERVERS === "true";
const managedClientUrl = "http://127.0.0.1:3100";
const managedApiUrl = "http://127.0.0.1:4100/api";
const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;

if (startManagedServers && !databaseUrl) {
  throw new Error(
    "PLAYWRIGHT_DATABASE_URL is required when PLAYWRIGHT_START_SERVERS=true. " +
      "Use a fresh, disposable PostgreSQL database because the E2E suite mutates seeded data.",
  );
}

if (startManagedServers && databaseUrl) {
  let parsedDatabaseUrl: URL;

  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error("PLAYWRIGHT_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  const databaseName = decodeURIComponent(
    parsedDatabaseUrl.pathname.replace(/^\/+/, ""),
  );
  const isPostgres = ["postgres:", "postgresql:"].includes(
    parsedDatabaseUrl.protocol,
  );
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsedDatabaseUrl.hostname,
  );
  const isExplicitE2eDatabase = /(?:^|[_-])e2e(?:$|[_-])/iu.test(databaseName);

  if (!isPostgres || !isLocal || !isExplicitE2eDatabase) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL must target a local PostgreSQL database whose name contains an e2e segment (for example opsflow_e2e).",
    );
  }
}

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

const serverDirectory = path.resolve(__dirname, "..", "server");
const evidenceDirectory = path.resolve(__dirname, "test-results", "evidence");

if (startManagedServers) {
  // Keep test helpers and the application on the same dedicated endpoints.
  process.env.PLAYWRIGHT_BASE_URL = managedClientUrl;
  process.env.PLAYWRIGHT_API_URL = managedApiUrl;
  process.env.PLAYWRIGHT_FAKE_AI_ENABLED = "true";
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: startManagedServers
      ? managedClientUrl
      : (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: startManagedServers
    ? [
        {
          command: process.env.CI ? "pnpm start" : "pnpm exec tsx src/server.ts",
          cwd: serverDirectory,
          url: `${managedApiUrl}/health`,
          env: {
            ...inheritedEnv,
            NODE_ENV: "development",
            PORT: "4100",
            CLIENT_URL: managedClientUrl,
            DATABASE_URL: databaseUrl!,
            JWT_ACCESS_SECRET: "playwright-e2e-access-secret",
            EVIDENCE_DIR: evidenceDirectory,
            ALLOW_FAKE_AI_PROVIDER: "true",
            AI_DISPATCH_PLANNER_PROVIDER: "fake",
            AI_DISPATCH_PLANNER_MODEL: "opsflow-scripted-e2e-v1",
            AI_INTENT_EXTRACTOR_ENABLED: "false",
          },
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: process.env.CI
            ? "pnpm exec next start --hostname 127.0.0.1 --port 3100"
            : "pnpm exec next dev --hostname 127.0.0.1 --port 3100",
          cwd: __dirname,
          url: managedClientUrl,
          env: {
            ...inheritedEnv,
            NODE_ENV: process.env.CI ? "production" : "development",
            NEXT_PUBLIC_API_URL: managedApiUrl,
            NEXT_DIST_DIR: process.env.CI ? ".next" : ".next-playwright",
          },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined,
});
