import { describe, expect, it } from "vitest";
import { registerSchema } from "@/features/auth/register-schema";

describe("registerSchema", () => {
  it("rejects invalid registration payload", () => {
    const parsed = registerSchema.safeParse({
      email: "invalid-email",
      password: "123",
      displayName: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts valid registration payload", () => {
    const parsed = registerSchema.safeParse({
      email: "owner@acme.example",
      password: "owner-password-123",
      displayName: "Avery Owner",
      tenantName: "Acme Home Services",
    });

    expect(parsed.success).toBe(true);
  });
});
