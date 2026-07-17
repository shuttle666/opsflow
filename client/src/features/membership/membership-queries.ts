import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  MembershipListQuery,
  UpdateMembershipRequest,
} from "@/types/membership";
import {
  listMembershipsRequest,
  updateMembershipRequest,
} from "./membership-api";

export function useMembershipsQuery(
  query: MembershipListQuery,
  enabled = true,
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.memberships.list(scope, query),
    queryFn: (accessToken) => listMembershipsRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateMembershipMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      variables: { membershipId: string; input: UpdateMembershipRequest },
    ) =>
      updateMembershipRequest(
        accessToken,
        variables.membershipId,
        variables.input,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.memberships.all(scope),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all(scope) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all(scope),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activity.all(scope),
        }),
      ]);
    },
  });
}
