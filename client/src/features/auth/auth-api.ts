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
  MyInvitationItem,
  RegisterInput,
  TenantInvitationItem,
  TenantInvitationMutationResult,
  InvitationStatus,
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

export async function refreshRequest() {
  const response = await apiClient.post<ApiSuccessResponse<AuthResult>>(
    "/auth/refresh",
    {},
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

export async function listMyInvitationsRequest(accessToken: string) {
  const response = await apiClient.get<ApiSuccessResponse<MyInvitationItem[]>>(
    "/invitations/mine",
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "My invitations response is missing payload.");
}

export async function acceptInvitationByIdRequest(
  accessToken: string,
  invitationId: string,
) {
  const response = await apiClient.post<ApiSuccessResponse<InvitationAcceptedResult>>(
    `/invitations/${invitationId}/accept`,
    {},
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Accept invitation response is missing payload.");
}

export async function listTenantInvitationsRequest(
  accessToken: string,
  tenantId: string,
  status?: InvitationStatus,
) {
  const searchParams = new URLSearchParams();
  if (status) {
    searchParams.set("status", status);
  }
  const query = searchParams.toString();

  const response = await apiClient.get<ApiSuccessResponse<TenantInvitationItem[]>>(
    `/tenants/${tenantId}/invitations${query ? `?${query}` : ""}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Tenant invitations response is missing payload.");
}

export async function resendInvitationRequest(
  accessToken: string,
  tenantId: string,
  invitationId: string,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<TenantInvitationMutationResult>
  >(`/tenants/${tenantId}/invitations/${invitationId}/resend`, {}, {
    headers: authHeader(accessToken),
  });

  return requireData(response, "Resend invitation response is missing payload.");
}

export async function cancelInvitationRequest(
  accessToken: string,
  tenantId: string,
  invitationId: string,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<TenantInvitationMutationResult>
  >(`/tenants/${tenantId}/invitations/${invitationId}/cancel`, {}, {
    headers: authHeader(accessToken),
  });

  return requireData(response, "Cancel invitation response is missing payload.");
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
