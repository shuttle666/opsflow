import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type { PaginationMeta } from "@/types/customer";
import type { ActivityFeedItem } from "@/types/activity";

function authHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function requireData<T>(response: ApiSuccessResponse<T>, fallbackMessage: string) {
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

export async function listActivityFeedRequest(
  accessToken: string,
  query: { page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();

  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }

  const serialized = params.toString();
  const response = await apiClient.get<ApiSuccessResponse<ActivityFeedItem[]>>(
    `/activity${serialized ? `?${serialized}` : ""}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Activity feed response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)
      ?.pagination ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      total: 0,
      totalPages: 1,
    }) satisfies PaginationMeta,
  };
}
