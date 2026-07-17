import { keepPreviousData } from "@tanstack/react-query";
import {
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import { getScheduleRangeRequest } from "./job-api";

type ScheduleRangeQuery = Parameters<typeof getScheduleRangeRequest>[1];

type ScheduleQueryOptions = {
  enabled?: boolean;
};

export function useScheduleRangeQuery(
  query: ScheduleRangeQuery,
  { enabled = true }: ScheduleQueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.schedule(scope, query),
    queryFn: (accessToken) => getScheduleRangeRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId),
    placeholderData: keepPreviousData,
  });
}
