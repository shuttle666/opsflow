import { create } from "zustand";
import {
  acceptInvitationByIdRequest,
  acceptInvitationRequest,
  cancelInvitationRequest,
  clearStoredTokens,
  createInvitationRequest,
  listMyInvitationsRequest,
  listTenantInvitationsRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  readStoredTokens,
  registerRequest,
  refreshRequest,
  resendInvitationRequest,
  switchTenantRequest,
  writeStoredTokens,
} from "@/features/auth";
import { ApiClientError } from "@/lib/api-client";
import type {
  AuthCredentials,
  AuthResult,
  AuthStatus,
  AuthUser,
  InvitationCreateInput,
  InvitationCreatedResult,
  InvitationAcceptedResult,
  RegisterInput,
  MyInvitationItem,
  TenantInvitationItem,
  TenantInvitationMutationResult,
  InvitationStatus,
  TenantMembership,
} from "@/types/auth";

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  currentTenant: TenantMembership | null;
  availableTenants: TenantMembership[];
  accessToken: string | null;
  refreshToken: string | null;
  bootstrapSession: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  createInvitation: (
    input: InvitationCreateInput,
  ) => Promise<InvitationCreatedResult>;
  listMyInvitations: () => Promise<MyInvitationItem[]>;
  acceptInvitationById: (
    invitationId: string,
  ) => Promise<InvitationAcceptedResult>;
  listTenantInvitations: (
    status?: InvitationStatus,
  ) => Promise<TenantInvitationItem[]>;
  resendInvitation: (
    invitationId: string,
  ) => Promise<TenantInvitationMutationResult>;
  cancelInvitation: (
    invitationId: string,
  ) => Promise<TenantInvitationMutationResult>;
  acceptInvitation: (token: string) => Promise<InvitationAcceptedResult>;
  clearSession: () => void;
  refreshAccessToken: () => Promise<AuthResult>;
  withAccessTokenRetry: <T>(request: (accessToken: string) => Promise<T>) => Promise<T>;
};

let refreshInFlight: Promise<AuthResult> | null = null;
let bootstrapInFlight: Promise<void> | null = null;

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected authentication error.";
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: "loading",
  user: null,
  currentTenant: null,
  availableTenants: [],
  accessToken: null,
  refreshToken: null,
  bootstrapSession: async () => {
    if (!bootstrapInFlight) {
      bootstrapInFlight = (async () => {
        const stored = readStoredTokens();
        if (!stored) {
          set({
            status: "unauthenticated",
            accessToken: null,
            refreshToken: null,
            user: null,
            currentTenant: null,
            availableTenants: [],
          });
          return;
        }

        set({
          status: "loading",
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
        });

        try {
          const loadMe = async () => {
            const me = await meRequest(get().accessToken ?? "");
            set({
              status: "authenticated",
              user: me.user,
              currentTenant: me.currentTenant,
              availableTenants: me.availableTenants,
            });
          };

          try {
            await loadMe();
          } catch (error) {
            if (!(error instanceof ApiClientError) || error.status !== 401) {
              throw error;
            }

            await get().refreshAccessToken();
            await loadMe();
          }
        } catch {
          get().clearSession();
        }
      })().finally(() => {
        bootstrapInFlight = null;
      });
    }

    await bootstrapInFlight;
  },
  register: async (input) => {
    set({ status: "loading" });

    try {
      const result = await registerRequest(input);
      writeStoredTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      set({
        status: "authenticated",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        currentTenant: result.currentTenant,
        availableTenants: result.availableTenants,
      });
    } catch (error) {
      get().clearSession();
      throw new Error(getErrorMessage(error));
    }
  },
  login: async (credentials) => {
    set({ status: "loading" });

    try {
      const result = await loginRequest(credentials);
      writeStoredTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      set({
        status: "authenticated",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        currentTenant: result.currentTenant,
        availableTenants: result.availableTenants,
      });
    } catch (error) {
      get().clearSession();
      throw new Error(getErrorMessage(error));
    }
  },
  logout: async (allDevices = false) => {
    try {
      const token = get().accessToken;
      if (token) {
        await logoutRequest(token, allDevices);
      }
    } catch {
      // Keep logout deterministic on the client side even if the server call fails.
    }

    get().clearSession();
  },
  switchTenant: async (tenantId: string) => {
    const result = await get().withAccessTokenRetry((accessToken) =>
      switchTenantRequest(accessToken, tenantId),
    );

    writeStoredTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    set({
      status: "authenticated",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      currentTenant: result.currentTenant,
      availableTenants: result.availableTenants,
    });
  },
  createInvitation: async (input) => {
    const tenantId = get().currentTenant?.tenantId;
    if (!tenantId) {
      throw new Error("No active tenant selected.");
    }

    return get().withAccessTokenRetry((accessToken) =>
      createInvitationRequest(accessToken, tenantId, input),
    );
  },
  listMyInvitations: async () =>
    get().withAccessTokenRetry((accessToken) =>
      listMyInvitationsRequest(accessToken),
    ),
  acceptInvitationById: async (invitationId: string) => {
    const accepted = await get().withAccessTokenRetry((accessToken) =>
      acceptInvitationByIdRequest(accessToken, invitationId),
    );

    const me = await get().withAccessTokenRetry((accessToken) =>
      meRequest(accessToken),
    );

    set({
      status: "authenticated",
      user: me.user,
      currentTenant: me.currentTenant,
      availableTenants: me.availableTenants,
    });

    return accepted;
  },
  listTenantInvitations: async (status) => {
    const tenantId = get().currentTenant?.tenantId;
    if (!tenantId) {
      throw new Error("No active tenant selected.");
    }

    return get().withAccessTokenRetry((accessToken) =>
      listTenantInvitationsRequest(accessToken, tenantId, status),
    );
  },
  resendInvitation: async (invitationId: string) => {
    const tenantId = get().currentTenant?.tenantId;
    if (!tenantId) {
      throw new Error("No active tenant selected.");
    }

    return get().withAccessTokenRetry((accessToken) =>
      resendInvitationRequest(accessToken, tenantId, invitationId),
    );
  },
  cancelInvitation: async (invitationId: string) => {
    const tenantId = get().currentTenant?.tenantId;
    if (!tenantId) {
      throw new Error("No active tenant selected.");
    }

    return get().withAccessTokenRetry((accessToken) =>
      cancelInvitationRequest(accessToken, tenantId, invitationId),
    );
  },
  acceptInvitation: async (token: string) => {
    const accepted = await get().withAccessTokenRetry((accessToken) =>
      acceptInvitationRequest(accessToken, token),
    );

    const me = await get().withAccessTokenRetry((accessToken) =>
      meRequest(accessToken),
    );

    set({
      status: "authenticated",
      user: me.user,
      currentTenant: me.currentTenant,
      availableTenants: me.availableTenants,
    });

    return accepted;
  },
  clearSession: () => {
    clearStoredTokens();
    set({
      status: "unauthenticated",
      accessToken: null,
      refreshToken: null,
      user: null,
      currentTenant: null,
      availableTenants: [],
    });
  },
  refreshAccessToken: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      throw new ApiClientError(401, "Refresh token is missing.");
    }

    if (!refreshInFlight) {
      refreshInFlight = refreshRequest(refreshToken)
        .then((result) => {
          writeStoredTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });

          set({
            status: "authenticated",
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
            currentTenant: result.currentTenant,
            availableTenants: result.availableTenants,
          });

          return result;
        })
        .catch((error) => {
          get().clearSession();
          throw error;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    return refreshInFlight;
  },
  withAccessTokenRetry: async <T>(request: (accessToken: string) => Promise<T>) => {
    let firstToken = get().accessToken;
    if (!firstToken && get().status === "loading") {
      await get().bootstrapSession();
      firstToken = get().accessToken;
    }

    if (!firstToken) {
      throw new ApiClientError(401, "Authentication is required.");
    }

    try {
      return await request(firstToken);
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 401) {
        throw error;
      }

      const refreshed = await get().refreshAccessToken();
      return request(refreshed.accessToken);
    }
  },
}));
