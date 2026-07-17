import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import type { QueryScope } from "@/lib/query-keys";

export function useAuthenticatedQueryScope(): QueryScope {
  const tenantId = useAuthStore((state) => state.currentTenant?.tenantId);
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.currentTenant?.role);

  return { tenantId, userId, role };
}

type AuthenticatedQueryOptions<
  TQueryFnData,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  UseQueryOptions<TQueryFnData, Error, TData, TQueryKey>,
  "enabled" | "queryFn"
> & {
  enabled?: boolean;
  queryFn: (accessToken: string) => Promise<TQueryFnData>;
};

export function useAuthenticatedQuery<
  TQueryFnData,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: AuthenticatedQueryOptions<TQueryFnData, TData, TQueryKey>,
): UseQueryResult<TData, Error> {
  const status = useAuthStore((state) => state.status);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const { enabled = true, queryFn, ...queryOptions } = options;

  return useQuery({
    ...queryOptions,
    enabled: enabled && status === "authenticated",
    queryFn: () => withAccessTokenRetry(queryFn),
  });
}

type AuthenticatedMutationOptions<TData, TVariables, TContext = unknown> = Omit<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  "mutationFn"
> & {
  mutationFn: (accessToken: string, variables: TVariables) => Promise<TData>;
};

export function useAuthenticatedMutation<
  TData,
  TVariables = void,
  TContext = unknown,
>(
  options: AuthenticatedMutationOptions<TData, TVariables, TContext>,
): UseMutationResult<TData, Error, TVariables, TContext> {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const { mutationFn, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    mutationFn: (variables) =>
      withAccessTokenRetry((accessToken) => mutationFn(accessToken, variables)),
  });
}
