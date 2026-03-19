import { MembershipRole } from "@prisma/client";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "../src/modules/auth/auth-tokens";

describe("auth token utilities", () => {
  it("signs and verifies access tokens", () => {
    const token = signAccessToken({
      userId: "user-1",
      sessionId: "session-1",
      tenantId: "tenant-1",
      role: MembershipRole.MANAGER,
    });

    const payload = verifyAccessToken(token);

    expect(payload.userId).toBe("user-1");
    expect(payload.sessionId).toBe("session-1");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.role).toBe(MembershipRole.MANAGER);
  });

  it("hashes refresh tokens deterministically", () => {
    const token = "same-refresh-token";

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken("other-token"));
  });

  it("generates random refresh tokens", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(20);
  });
});

