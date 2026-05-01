import { parseEnv } from "../src/config/env";

describe("env parsing", () => {
  it("rejects the default JWT secret in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        PORT: "4000",
        CLIENT_URL: "https://app.example.com",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
      }),
    ).toThrow("JWT_ACCESS_SECRET must be explicitly configured in production.");
  });

  it("allows the default JWT secret outside production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
      }),
    ).not.toThrow();
  });

  it("applies default AI dispatch planner settings", () => {
    expect(
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
      }),
    ).toEqual(
      expect.objectContaining({
        AI_DISPATCH_PLANNER_PROVIDER: "anthropic",
        AI_DISPATCH_PLANNER_MODEL: "claude-sonnet-4-20250514",
        AI_DISPATCH_PLANNER_MAX_TOKENS: 4096,
        AI_DISPATCH_PLANNER_MAX_ITERATIONS: 10,
        AI_INTENT_EXTRACTOR_ENABLED: false,
        AI_INTENT_EXTRACTOR_PROVIDER: "openai",
        AI_INTENT_EXTRACTOR_MODEL: "gpt-4.1-mini",
        AI_INTENT_EXTRACTOR_MAX_TOKENS: 800,
        AI_INTENT_EXTRACTOR_TEMPERATURE: 0,
        AI_INTENT_EXTRACTOR_TIMEOUT_MS: 2500,
      }),
    );
  });

  it("parses explicit AI dispatch planner settings", () => {
    expect(
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        AI_DISPATCH_PLANNER_PROVIDER: "anthropic",
        AI_DISPATCH_PLANNER_MODEL: "claude-test-model",
        AI_DISPATCH_PLANNER_MAX_TOKENS: "2048",
        AI_DISPATCH_PLANNER_MAX_ITERATIONS: "6",
        AI_DISPATCH_PLANNER_TEMPERATURE: "0.2",
        AI_INTENT_EXTRACTOR_ENABLED: "true",
        AI_INTENT_EXTRACTOR_MODEL: "openai-test-model",
        AI_INTENT_EXTRACTOR_MAX_TOKENS: "300",
        AI_INTENT_EXTRACTOR_TEMPERATURE: "0",
        AI_INTENT_EXTRACTOR_TIMEOUT_MS: "1200",
      }),
    ).toEqual(
      expect.objectContaining({
        AI_DISPATCH_PLANNER_PROVIDER: "anthropic",
        AI_DISPATCH_PLANNER_MODEL: "claude-test-model",
        AI_DISPATCH_PLANNER_MAX_TOKENS: 2048,
        AI_DISPATCH_PLANNER_MAX_ITERATIONS: 6,
        AI_DISPATCH_PLANNER_TEMPERATURE: 0.2,
        AI_INTENT_EXTRACTOR_ENABLED: true,
        AI_INTENT_EXTRACTOR_MODEL: "openai-test-model",
        AI_INTENT_EXTRACTOR_MAX_TOKENS: 300,
        AI_INTENT_EXTRACTOR_TEMPERATURE: 0,
        AI_INTENT_EXTRACTOR_TIMEOUT_MS: 1200,
      }),
    );
  });

  it("rejects invalid AI dispatch planner settings", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        AI_DISPATCH_PLANNER_MAX_ITERATIONS: "0",
      }),
    ).toThrow("Invalid environment variables");
  });
});
