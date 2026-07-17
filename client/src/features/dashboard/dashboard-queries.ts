import { useAuthenticatedQuery, useAuthenticatedQueryScope } from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardSummaryQuery } from "@/types/dashboard";
import { getDashboardSummaryRequest } from "./dashboard-api";

export function useDashboardSummaryQuery(query: DashboardSummaryQuery) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.dashboard.summary(scope, query),
    queryFn: (accessToken) => getDashboardSummaryRequest(accessToken, query),
    enabled: Boolean(scope.tenantId),
  });
}
