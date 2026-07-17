import { useQueryClient } from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import { assignJobRequest, unassignJobRequest } from "./job-api";

type JobAssignmentVariables =
  | {
      action: "assign";
      jobId: string;
      membershipId: string;
    }
  | {
      action: "unassign";
      jobId: string;
    };

export function useJobAssignmentMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, variables: JobAssignmentVariables) =>
      variables.action === "assign"
        ? assignJobRequest(accessToken, variables.jobId, {
            membershipId: variables.membershipId,
          })
        : unassignJobRequest(accessToken, variables.jobId),
    onSuccess: (updatedJob, variables) => {
      queryClient.setQueryData(
        queryKeys.jobs.detail(scope, variables.jobId),
        updatedJob,
      );

      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.detail(scope, variables.jobId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.lists(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.myLists(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.schedules(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.memberships.all(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.activity.all(scope),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all(scope),
          refetchType: "none",
        }),
      ]);
    },
  });
}
