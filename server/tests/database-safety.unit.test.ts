const databaseMocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    toolInvocation: {
      deleteMany: databaseMocks.deleteMany,
    },
  },
}));

import {
  assertSafeDatabaseResetEnvironment,
  assertSafeTestDatabaseUrl,
} from "./helpers/database-safety";
import { resetDatabase } from "./helpers/db";

const safeDatabaseUrl =
  "postgresql://opsflow:opsflow@localhost:5432/opsflow_test?schema=public";

describe("database test reset safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_test?schema=public",
    "postgres://opsflow:opsflow@127.0.0.1:5432/opsflow-e2e",
    "postgresql://opsflow:opsflow@[::1]:5432/test_opsflow",
  ])("accepts an explicitly disposable local PostgreSQL database: %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    undefined,
    "not-a-url",
    "mysql://opsflow:opsflow@localhost:3306/opsflow_test",
    "postgresql://opsflow:opsflow@db.example.com:5432/opsflow_test",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow",
    "postgresql://opsflow:opsflow@localhost:5432/contest",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_test?host=prod.example.com",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_test?host=%2Fvar%2Frun%2Fpostgresql",
  ])("rejects a database that is not explicitly disposable: %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow();
  });

  it("requires both destructive-test opt-in flags", () => {
    expect(() =>
      assertSafeDatabaseResetEnvironment({
        RUN_DB_TESTS: "true",
        ALLOW_DB_TEST_RESET: "false",
        DATABASE_URL: safeDatabaseUrl,
      }),
    ).toThrow("RUN_DB_TESTS=true and ALLOW_DB_TEST_RESET=true");
  });

  it("checks the current environment inside every resetDatabase call", async () => {
    vi.stubEnv("RUN_DB_TESTS", "false");
    vi.stubEnv("ALLOW_DB_TEST_RESET", "true");
    vi.stubEnv("DATABASE_URL", safeDatabaseUrl);

    await expect(resetDatabase()).rejects.toThrow(
      "RUN_DB_TESTS=true and ALLOW_DB_TEST_RESET=true",
    );
    expect(databaseMocks.deleteMany).not.toHaveBeenCalled();

    vi.stubEnv("RUN_DB_TESTS", "true");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://opsflow:opsflow@localhost:5432/opsflow",
    );

    await expect(resetDatabase()).rejects.toThrow(
      "Refusing to reset DATABASE_URL",
    );
    expect(databaseMocks.deleteMany).not.toHaveBeenCalled();
  });
});
