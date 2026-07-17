import { keepPreviousData } from "@tanstack/react-query";
import { useAuthenticatedQuery, useAuthenticatedQueryScope } from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import { listActivityFeedRequest } from "./activity-api";

type ActivityListQuery = {
  page: number;
  pageSize: number;
};

export function useActivityFeedQuery(query: ActivityListQuery, enabled = true) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.activity.list(scope, query),
    queryFn: (accessToken) => listActivityFeedRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId),
    placeholderData: keepPreviousData,
  });
}
