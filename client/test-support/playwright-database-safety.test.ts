import { describe, expect, it } from "vitest";
import { assertSafePlaywrightDatabaseUrl } from "./playwright-database-safety";

describe("Playwright database safety", () => {
  it.each([
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_e2e?schema=public",
    "postgres://opsflow:opsflow@127.0.0.1:5432/e2e-opsflow",
    "postgresql://opsflow:opsflow@[::1]:5432/opsflow-e2e-test",
  ])("accepts an explicitly disposable local database: %s", (url) => {
    expect(assertSafePlaywrightDatabaseUrl(url)).toBe(url);
  });

  it.each([
    undefined,
    "not-a-url",
    "mysql://opsflow:opsflow@localhost:3306/opsflow_e2e",
    "postgresql://opsflow:opsflow@db.example.com:5432/opsflow_e2e",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow",
    "postgresql://opsflow:opsflow@localhost:5432/contest",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_e2e?host=prod.example.com",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_e2e?HOST=%2Fvar%2Frun%2Fpostgresql",
  ])("rejects a database that is not explicitly disposable: %s", (url) => {
    expect(() => assertSafePlaywrightDatabaseUrl(url)).toThrow();
  });
});
