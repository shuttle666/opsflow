const postgresProtocols = new Set(["postgres:", "postgresql:"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const disposableDatabaseSegment = /(?:^|[_-])(?:test|e2e)(?:$|[_-])/iu;

type DatabaseResetEnvironment = {
  RUN_DB_TESTS?: string;
  ALLOW_DB_TEST_RESET?: string;
  DATABASE_URL?: string;
};

export function assertSafeTestDatabaseUrl(value: string | undefined) {
  if (!value) {
    throw new Error(
      "DATABASE_URL is required when database integration tests are enabled.",
    );
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL when database integration tests are enabled.",
    );
  }

  const databaseName = decodeURIComponent(
    databaseUrl.pathname.replace(/^\/+/, ""),
  );
  const isPostgres = postgresProtocols.has(databaseUrl.protocol);
  const isLocal = loopbackHosts.has(databaseUrl.hostname);
  const isDisposable = disposableDatabaseSegment.test(databaseName);
  // pg-connection-string lets a query parameter override the URL hostname.
  // Reject it outright so the guard validates the effective destination.
  const hasHostOverride = databaseUrl.searchParams.has("host");

  if (!isPostgres || !isLocal || !isDisposable || hasHostOverride) {
    throw new Error(
      "Refusing to reset DATABASE_URL. Database integration tests require a local PostgreSQL database whose name contains a test or e2e segment (for example opsflow_test).",
    );
  }
}

export function assertSafeDatabaseResetEnvironment(
  environment: DatabaseResetEnvironment,
) {
  if (
    environment.RUN_DB_TESTS !== "true" ||
    environment.ALLOW_DB_TEST_RESET !== "true"
  ) {
    throw new Error(
      "Refusing to reset the database without RUN_DB_TESTS=true and ALLOW_DB_TEST_RESET=true.",
    );
  }

  assertSafeTestDatabaseUrl(environment.DATABASE_URL);
}
