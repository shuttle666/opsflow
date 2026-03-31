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
});
