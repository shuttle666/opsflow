import {
  apiClient,
  type ApiSuccessResponse,
} from "@/lib/api-client";
import type {
  AuthCredentials,
  AuthResult,
  InvitationCreateInput,
  InvitationCreatedResult,
  InvitationAcceptedResult,
  MeResult,
  RegisterInput,
} from "@/types/auth";

function requireData<T>(response: ApiSuccessResponse<T>, fallbackMessage: string) {
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

function authHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function loginRequest(credentials: AuthCredentials) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResult>>(
    "/auth/login",
    credentials,
  );

  return requireData(response, "Login response is missing payload.");
}

export async function registerRequest(input: RegisterInput) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResult>>(
    "/auth/register",
    input,
  );

  return requireData(response, "Register response is missing payload.");
}

export async function refreshRequest(refreshToken: string) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResult>>(
    "/auth/refresh",
    { refreshToken },
  );

  return requireData(response, "Refresh response is missing payload.");
}

export async function logoutRequest(accessToken: string, allDevices = false) {
  await apiClient.post<ApiSuccessResponse<unknown>>(
    "/auth/logout",
    { allDevices },
    {
      headers: authHeader(accessToken),
    },
  );
}

export async function meRequest(accessToken: string) {
  const response = await apiClient.get<ApiSuccessResponse<MeResult>>("/auth/me", {
    headers: authHeader(accessToken),
  });

  return requireData(response, "Current user response is missing payload.");
}

export async function switchTenantRequest(accessToken: string, tenantId: string) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResult>>(
    "/auth/switch-tenant",
    { tenantId },
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Switch tenant response is missing payload.");
}

export async function createInvitationRequest(
  accessToken: string,
  tenantId: string,
  input: InvitationCreateInput,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<InvitationCreatedResult>
  >(`/tenants/${tenantId}/invitations`, input, {
    headers: authHeader(accessToken),
  });

  return requireData(response, "Create invitation response is missing payload.");
}

export async function acceptInvitationRequest(
  accessToken: string,
  token: string,
) {
  const response = await apiClient.post<ApiSuccessResponse<InvitationAcceptedResult>>(
    "/invitations/accept",
    { token },
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Accept invitation response is missing payload.");
}
