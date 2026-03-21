import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type { PaginationMeta } from "@/types/customer";
import type {
  MembershipListItem,
  MembershipListQuery,
  UpdateMembershipRequest,
} from "@/types/membership";

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

function buildMembershipQuery(query: MembershipListQuery) {
  const params = new URLSearchParams();

  if (query.status) {
    params.set("status", query.status);
  }
  if (query.role) {
    params.set("role", query.role);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listMembershipsRequest(
  accessToken: string,
  query: MembershipListQuery,
) {
  const response = await apiClient.get<ApiSuccessResponse<MembershipListItem[]>>(
    `/memberships${buildMembershipQuery(query)}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Membership list response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)
      ?.pagination ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      total: 0,
      totalPages: 1,
    }) satisfies PaginationMeta,
  };
}

export async function updateMembershipRequest(
  accessToken: string,
  membershipId: string,
  input: UpdateMembershipRequest,
) {
  const response = await apiClient.patch<ApiSuccessResponse<MembershipListItem>>(
    `/memberships/${membershipId}`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Update membership response is missing payload.");
}
