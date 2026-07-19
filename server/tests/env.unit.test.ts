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

  it("requires production to explicitly enable private demo workspaces", () => {
    expect(
      parseEnv({
        NODE_ENV: "production",
        PORT: "4000",
        CLIENT_URL: "https://app.example.com",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "production-access-secret",
      }),
    ).toEqual(
      expect.objectContaining({
        DEMO_WORKSPACE_ENABLED: false,
      }),
    );

    expect(
      parseEnv({
        NODE_ENV: "production",
        PORT: "4000",
        CLIENT_URL: "https://app.example.com",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "production-access-secret",
        DEMO_WORKSPACE_ENABLED: "true",
      }),
    ).toEqual(
      expect.objectContaining({
        DEMO_WORKSPACE_ENABLED: true,
      }),
    );
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

  it("applies safe proxy and evidence upload defaults", () => {
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
        TRUST_PROXY_HOPS: 0,
        EVIDENCE_MAX_SIZE_BYTES: 10 * 1024 * 1024,
        DEMO_WORKSPACE_ENABLED: true,
        DEMO_WORKSPACE_TTL_MINUTES: 60,
        DEMO_WORKSPACE_MAX_ACTIVE: 100,
        DEMO_WORKSPACE_CREATE_LIMIT: 5,
        DEMO_WORKSPACE_AI_REQUEST_LIMIT: 6,
        DEMO_WORKSPACE_CLEANUP_INTERVAL_SECONDS: 5 * 60,
        DEMO_WORKSPACE_CLEANUP_BATCH_SIZE: 20,
      }),
    );
  });

  it("parses bounded private demo workspace settings", () => {
    expect(
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        DEMO_WORKSPACE_ENABLED: "false",
        DEMO_WORKSPACE_TTL_MINUTES: "90",
        DEMO_WORKSPACE_MAX_ACTIVE: "25",
        DEMO_WORKSPACE_CREATE_LIMIT: "3",
        DEMO_WORKSPACE_AI_REQUEST_LIMIT: "4",
        DEMO_WORKSPACE_CLEANUP_INTERVAL_SECONDS: "120",
        DEMO_WORKSPACE_CLEANUP_BATCH_SIZE: "10",
      }),
    ).toEqual(
      expect.objectContaining({
        DEMO_WORKSPACE_ENABLED: false,
        DEMO_WORKSPACE_TTL_MINUTES: 90,
        DEMO_WORKSPACE_MAX_ACTIVE: 25,
        DEMO_WORKSPACE_CREATE_LIMIT: 3,
        DEMO_WORKSPACE_AI_REQUEST_LIMIT: 4,
        DEMO_WORKSPACE_CLEANUP_INTERVAL_SECONDS: 120,
        DEMO_WORKSPACE_CLEANUP_BATCH_SIZE: 10,
      }),
    );
  });

  it("parses explicit proxy and evidence upload limits", () => {
    expect(
      parseEnv({
        NODE_ENV: "development",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        TRUST_PROXY_HOPS: "1",
        EVIDENCE_MAX_SIZE_BYTES: "12582912",
      }),
    ).toEqual(
      expect.objectContaining({
        TRUST_PROXY_HOPS: 1,
        EVIDENCE_MAX_SIZE_BYTES: 12 * 1024 * 1024,
      }),
    );
  });

  it.each(["-1", "1.5", "11", "not-a-number"])(
    "rejects an invalid trusted proxy hop count (%s)",
    (trustProxyHops) => {
      expect(() =>
        parseEnv({
          NODE_ENV: "development",
          PORT: "4000",
          CLIENT_URL: "http://localhost:3000",
          DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
          JWT_ACCESS_SECRET: "dev-access-secret-change-me",
          TRUST_PROXY_HOPS: trustProxyHops,
        }),
      ).toThrow("Invalid environment variables");
    },
  );

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
        ALLOW_FAKE_AI_PROVIDER: false,
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

  it("requires an explicit opt-in for the fake AI provider", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "test",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        AI_DISPATCH_PLANNER_PROVIDER: "fake",
      }),
    ).toThrow(
      "ALLOW_FAKE_AI_PROVIDER=true is required to use the fake AI provider.",
    );
  });

  it("allows the opted-in fake AI provider outside production without an API key", () => {
    expect(
      parseEnv({
        NODE_ENV: "test",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        AI_DISPATCH_PLANNER_PROVIDER: "fake",
        ALLOW_FAKE_AI_PROVIDER: "true",
        AI_DISPATCH_PLANNER_MODEL: "opsflow-scripted-e2e-v1",
      }),
    ).toEqual(
      expect.objectContaining({
        NODE_ENV: "test",
        AI_DISPATCH_PLANNER_PROVIDER: "fake",
        ALLOW_FAKE_AI_PROVIDER: true,
        AI_DISPATCH_PLANNER_MODEL: "opsflow-scripted-e2e-v1",
        ANTHROPIC_API_KEY: "",
        OPENAI_API_KEY: "",
      }),
    );
  });

  it("always rejects the fake AI provider in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        PORT: "4000",
        CLIENT_URL: "https://app.example.com",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "production-access-secret",
        AI_DISPATCH_PLANNER_PROVIDER: "fake",
        ALLOW_FAKE_AI_PROVIDER: "true",
      }),
    ).toThrow("Fake AI provider cannot be enabled in production.");
  });

  it("rejects a network-backed intent extractor alongside the fake provider", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "test",
        PORT: "4000",
        CLIENT_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://opsflow:opsflow@localhost:5432/opsflow",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        AI_DISPATCH_PLANNER_PROVIDER: "fake",
        ALLOW_FAKE_AI_PROVIDER: "true",
        AI_INTENT_EXTRACTOR_ENABLED: "true",
      }),
    ).toThrow(
      "AI_INTENT_EXTRACTOR_ENABLED must be false when using the fake AI provider.",
    );
  });
});
