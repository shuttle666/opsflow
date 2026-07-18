import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeDevelopmentDatabaseUrl } from "../prisma/demo-data";

describe("destructive E2E seed safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_e2e?schema=public",
    "postgres://opsflow:opsflow@127.0.0.1:5432/e2e-opsflow",
    "postgresql://opsflow:opsflow@[::1]:5432/opsflow-e2e-test",
  ])("accepts a local database with an explicit e2e name: %s", (url) => {
    vi.stubEnv("E2E_SEED", "1");

    expect(() => assertSafeDevelopmentDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    "postgresql://opsflow:opsflow@db.example.com:5432/opsflow_e2e",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow",
    "postgresql://opsflow:opsflow@localhost:5432/contest",
    "postgresql://opsflow:opsflow@localhost:5432/opsflow_e2e?host=prod.example.com",
  ])("rejects an unsafe E2E seed target: %s", (url) => {
    vi.stubEnv("E2E_SEED", "1");

    expect(() => assertSafeDevelopmentDatabaseUrl(url)).toThrow(
      "Refusing E2E seed",
    );
  });
});
