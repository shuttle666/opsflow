import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { AuthResult } from "@/types/auth";
import { useAuthStore } from "@/store/auth-store";
import {
  createInvitationRequest,
  registerRequest,
  refreshRequest,
} from "@/features/auth";

vi.mock("@/features/auth", () => ({
  acceptInvitationRequest: vi.fn(),
  clearStoredTokens: vi.fn(),
  createInvitationRequest: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  meRequest: vi.fn(),
  readStoredTokens: vi.fn(() => null),
  refreshRequest: vi.fn(),
  registerRequest: vi.fn(),
  switchTenantRequest: vi.fn(),
  writeStoredTokens: vi.fn(),
}));

function buildAuthResult(): AuthResult {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresInMinutes: 15,
    user: {
      id: "user-1",
      email: "owner@acme.example",
      displayName: "Avery Owner",
    },
    currentTenant: {
      tenantId: "tenant-1",
      tenantName: "Acme Home Services",
      tenantSlug: "acme-home-services",
      role: "OWNER",
    },
    availableTenants: [
      {
        tenantId: "tenant-1",
        tenantName: "Acme Home Services",
        tenantSlug: "acme-home-services",
        role: "OWNER",
      },
    ],
  };
}

describe("auth store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: "unauthenticated",
      user: null,
      currentTenant: null,
      availableTenants: [],
      accessToken: null,
      refreshToken: null,
    });
  });

  it("registers and sets authenticated session state", async () => {
    const result = buildAuthResult();
    vi.mocked(registerRequest).mockResolvedValue(result);

    await useAuthStore.getState().register({
      email: result.user.email,
      password: "owner-password-123",
      displayName: result.user.displayName,
      tenantName: result.currentTenant.tenantName,
    });

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user?.email).toBe(result.user.email);
    expect(state.currentTenant?.tenantId).toBe(result.currentTenant.tenantId);
    expect(state.accessToken).toBe(result.accessToken);
    expect(state.refreshToken).toBe(result.refreshToken);
  });

  it("retries one time after refresh when request returns 401", async () => {
    const refreshed = buildAuthResult();
    vi.mocked(refreshRequest).mockResolvedValue(refreshed);
    useAuthStore.setState({
      status: "authenticated",
      user: refreshed.user,
      currentTenant: refreshed.currentTenant,
      availableTenants: refreshed.availableTenants,
      accessToken: "expired-access-token",
      refreshToken: "valid-refresh-token",
    });

    const request = vi
      .fn<(token: string) => Promise<string>>()
      .mockRejectedValueOnce(new ApiClientError(401, "expired"))
      .mockResolvedValueOnce("ok");

    const result = await useAuthStore.getState().withAccessTokenRetry(request);

    expect(result).toBe("ok");
    expect(request).toHaveBeenCalledTimes(2);
    expect(vi.mocked(refreshRequest)).toHaveBeenCalledTimes(1);
  });

  it("creates invitation with active tenant context", async () => {
    vi.mocked(createInvitationRequest).mockResolvedValue({
      id: "invitation-1",
      tenantId: "tenant-1",
      email: "new.member@example.com",
      role: "STAFF",
      expiresAt: "2026-03-28T12:00:00.000Z",
      token: "invite-token",
    });

    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@acme.example",
        displayName: "Avery Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme Home Services",
        tenantSlug: "acme-home-services",
        role: "OWNER",
      },
      availableTenants: [
        {
          tenantId: "tenant-1",
          tenantName: "Acme Home Services",
          tenantSlug: "acme-home-services",
          role: "OWNER",
        },
      ],
      accessToken: "token-1",
      refreshToken: "refresh-1",
    });

    const created = await useAuthStore.getState().createInvitation({
      email: "new.member@example.com",
      role: "STAFF",
    });

    expect(created.token).toBe("invite-token");
    expect(vi.mocked(createInvitationRequest)).toHaveBeenCalledWith(
      "token-1",
      "tenant-1",
      {
        email: "new.member@example.com",
        role: "STAFF",
      },
    );
  });
});
