import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { assertSafePlaywrightDatabaseUrl } from "./test-support/playwright-database-safety";

const startManagedServers = process.env.PLAYWRIGHT_START_SERVERS === "true";
const managedClientUrl = "http://127.0.0.1:3100";
const managedApiUrl = "http://127.0.0.1:4100/api";
const databaseUrl = startManagedServers
  ? assertSafePlaywrightDatabaseUrl(process.env.PLAYWRIGHT_DATABASE_URL)
  : process.env.PLAYWRIGHT_DATABASE_URL;

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
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Every scenario uses the same seeded demo identities. Serial workers prevent
  // concurrent logins from evicting another scenario's bounded auth session.
  workers: 1,
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
          name: "api",
          command: process.env.CI ? "pnpm start" : "pnpm exec tsx src/server.ts",
          cwd: serverDirectory,
          url: `${managedApiUrl}/health`,
          env: {
            ...inheritedEnv,
            NODE_ENV: "test",
            PORT: "4100",
            CLIENT_URL: managedClientUrl,
            DATABASE_URL: databaseUrl!,
            JWT_ACCESS_SECRET: "playwright-e2e-access-secret",
            EVIDENCE_DIR: evidenceDirectory,
            ALLOW_FAKE_AI_PROVIDER: "true",
            AI_DISPATCH_PLANNER_PROVIDER: "fake",
            AI_DISPATCH_PLANNER_MODEL: "opsflow-scripted-e2e-v1",
            AI_INTENT_EXTRACTOR_ENABLED: "false",
            ANTHROPIC_API_KEY: "",
            OPENAI_API_KEY: "",
          },
          stdout: process.env.CI ? "pipe" : "ignore",
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          name: "client",
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
          stdout: process.env.CI ? "pipe" : "ignore",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined,
});
