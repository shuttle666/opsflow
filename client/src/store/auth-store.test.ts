import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { AuthResult } from "@/types/auth";
import { useAuthStore } from "@/store/auth-store";
import {
  acceptInvitationByIdRequest,
  cancelInvitationRequest,
  createInvitationRequest,
  listMyInvitationsRequest,
  listTenantInvitationsRequest,
  meRequest,
  registerRequest,
  refreshRequest,
  resendInvitationRequest,
} from "@/features/auth";

vi.mock("@/features/auth", () => ({
  acceptInvitationByIdRequest: vi.fn(),
  acceptInvitationRequest: vi.fn(),
  cancelInvitationRequest: vi.fn(),
  clearStoredTokens: vi.fn(),
  createInvitationRequest: vi.fn(),
  listMyInvitationsRequest: vi.fn(),
  listTenantInvitationsRequest: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  meRequest: vi.fn(),
  readStoredTokens: vi.fn(() => null),
  refreshRequest: vi.fn(),
  registerRequest: vi.fn(),
  resendInvitationRequest: vi.fn(),
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

    expect(created.email).toBe("new.member@example.com");
    expect(vi.mocked(createInvitationRequest)).toHaveBeenCalledWith(
      "token-1",
      "tenant-1",
      {
        email: "new.member@example.com",
        role: "STAFF",
      },
    );
  });

  it("loads my invitations and manages tenant invitations with retry helper", async () => {
    vi.mocked(listMyInvitationsRequest).mockResolvedValue([
      {
        id: "invitation-1",
        tenantId: "tenant-2",
        tenantName: "Acme Field Ops",
        role: "STAFF",
        status: "PENDING",
        expiresAt: "2026-03-28T12:00:00.000Z",
        createdAt: "2026-03-20T01:00:00.000Z",
      },
    ]);
    vi.mocked(listTenantInvitationsRequest).mockResolvedValue([
      {
        id: "invitation-2",
        email: "member@acme.example",
        role: "STAFF",
        status: "PENDING",
        expiresAt: "2026-03-28T12:00:00.000Z",
        createdAt: "2026-03-20T01:00:00.000Z",
        invitedBy: {
          id: "user-1",
          email: "owner@acme.example",
          displayName: "Avery Owner",
        },
      },
    ]);
    vi.mocked(resendInvitationRequest).mockResolvedValue({
      id: "invitation-2",
      status: "PENDING",
      expiresAt: "2026-03-30T12:00:00.000Z",
    });
    vi.mocked(cancelInvitationRequest).mockResolvedValue({
      id: "invitation-2",
      status: "CANCELLED",
      expiresAt: "2026-03-30T12:00:00.000Z",
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

    const mine = await useAuthStore.getState().listMyInvitations();
    expect(mine).toHaveLength(1);
    expect(vi.mocked(listMyInvitationsRequest)).toHaveBeenCalledWith("token-1");

    const tenantList = await useAuthStore.getState().listTenantInvitations();
    expect(tenantList).toHaveLength(1);
    expect(vi.mocked(listTenantInvitationsRequest)).toHaveBeenCalledWith(
      "token-1",
      "tenant-1",
      undefined,
    );

    const resent = await useAuthStore.getState().resendInvitation("invitation-2");
    expect(resent.status).toBe("PENDING");
    expect(vi.mocked(resendInvitationRequest)).toHaveBeenCalledWith(
      "token-1",
      "tenant-1",
      "invitation-2",
    );

    const cancelled = await useAuthStore.getState().cancelInvitation("invitation-2");
    expect(cancelled.status).toBe("CANCELLED");
    expect(vi.mocked(cancelInvitationRequest)).toHaveBeenCalledWith(
      "token-1",
      "tenant-1",
      "invitation-2",
    );
  });

  it("accepts invitation by id and refreshes me context", async () => {
    vi.mocked(acceptInvitationByIdRequest).mockResolvedValue({
      tenantId: "tenant-2",
      role: "STAFF",
    });
    const refreshed = buildAuthResult();
    vi.mocked(meRequest).mockResolvedValue({
      user: refreshed.user,
      currentTenant: refreshed.currentTenant,
      availableTenants: refreshed.availableTenants,
    });

    useAuthStore.setState({
      status: "authenticated",
      user: refreshed.user,
      currentTenant: refreshed.currentTenant,
      availableTenants: refreshed.availableTenants,
      accessToken: "token-1",
      refreshToken: "refresh-1",
    });

    const accepted = await useAuthStore
      .getState()
      .acceptInvitationById("invitation-7");

    expect(accepted.tenantId).toBe("tenant-2");
    expect(vi.mocked(acceptInvitationByIdRequest)).toHaveBeenCalledWith(
      "token-1",
      "invitation-7",
    );
    expect(vi.mocked(meRequest)).toHaveBeenCalled();
  });
});
