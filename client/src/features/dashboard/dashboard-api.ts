import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type { DashboardSummary, DashboardSummaryQuery } from "@/types/dashboard";

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

function buildDashboardSummaryQuery(query: DashboardSummaryQuery) {
  const params = new URLSearchParams();
  params.set("date", query.date);

  if (query.timezoneOffsetMinutes !== undefined) {
    params.set("timezoneOffsetMinutes", String(query.timezoneOffsetMinutes));
  }
  if (query.schedulePreviewLimit !== undefined) {
    params.set("schedulePreviewLimit", String(query.schedulePreviewLimit));
  }
  if (query.attentionLimit !== undefined) {
    params.set("attentionLimit", String(query.attentionLimit));
  }

  return params.toString();
}

export async function getDashboardSummaryRequest(
  accessToken: string,
  query: DashboardSummaryQuery,
) {
  const response = await apiClient.get<ApiSuccessResponse<DashboardSummary>>(
    `/dashboard/summary?${buildDashboardSummaryQuery(query)}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Dashboard summary response is missing payload.");
}
