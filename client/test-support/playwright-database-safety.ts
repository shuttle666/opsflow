const postgresProtocols = new Set(["postgres:", "postgresql:"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const e2eDatabaseSegment = /(?:^|[_-])e2e(?:$|[_-])/iu;

export function assertSafePlaywrightDatabaseUrl(value: string | undefined) {
  if (!value) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL is required when PLAYWRIGHT_START_SERVERS=true. " +
        "Use a fresh, disposable PostgreSQL database because the E2E suite mutates seeded data.",
    );
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error("PLAYWRIGHT_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("PLAYWRIGHT_DATABASE_URL contains an invalid database name.");
  }

  const hasHostOverride = Array.from(databaseUrl.searchParams.keys()).some(
    (key) => key.toLowerCase() === "host",
  );
  const isSafe =
    postgresProtocols.has(databaseUrl.protocol) &&
    loopbackHosts.has(databaseUrl.hostname) &&
    e2eDatabaseSegment.test(databaseName) &&
    !hasHostOverride;

  if (!isSafe) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL must target a local PostgreSQL database whose name contains an e2e segment (for example opsflow_e2e), without a host query override.",
    );
  }

  return value;
}
