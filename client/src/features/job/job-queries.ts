import {
  keepPreviousData,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import type {
  CreateJobInput,
  JobCompletionReviewMutationResult,
  JobEvidenceItem,
  JobHistoryResult,
  JobListQuery,
  JobStatusTransitionRequest,
  JobStatusTransitionResult,
  ReturnJobCompletionReviewRequest,
  SubmitJobCompletionReviewRequest,
  UpdateJobInput,
  UploadJobEvidenceInput,
} from "@/types/job";
import {
  approveJobCompletionReviewRequest,
  createJobRequest,
  deleteJobEvidenceRequest,
  getJobDetailRequest,
  getJobHistoryRequest,
  getLatestJobCompletionReviewRequest,
  listJobEvidenceRequest,
  listJobsRequest,
  listMyJobsRequest,
  returnJobCompletionReviewRequest,
  submitJobCompletionReviewRequest,
  transitionJobStatusRequest,
  updateJobRequest,
  uploadJobEvidenceRequest,
} from "./job-api";

type QueryOptions = {
  enabled?: boolean;
};

export function useJobsQuery(
  query: JobListQuery,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.list(scope, query),
    queryFn: (accessToken) => listJobsRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useMyJobsQuery(
  query: JobListQuery,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.myList(scope, query),
    queryFn: (accessToken) => listMyJobsRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId && scope.userId),
    placeholderData: keepPreviousData,
  });
}

export function useJobDetailQuery(
  jobId: string,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.detail(scope, jobId),
    queryFn: (accessToken) => getJobDetailRequest(accessToken, jobId),
    enabled: enabled && Boolean(scope.tenantId && jobId),
  });
}

export function useJobHistoryQuery(
  jobId: string,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.history(scope, jobId),
    queryFn: (accessToken) => getJobHistoryRequest(accessToken, jobId),
    enabled: enabled && Boolean(scope.tenantId && jobId),
  });
}

export function useJobEvidenceQuery(
  jobId: string,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.evidence(scope, jobId),
    queryFn: (accessToken) => listJobEvidenceRequest(accessToken, jobId),
    enabled: enabled && Boolean(scope.tenantId && jobId),
  });
}

export function useJobCompletionReviewQuery(
  jobId: string,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.jobs.completionReview(scope, jobId),
    queryFn: (accessToken) =>
      getLatestJobCompletionReviewRequest(accessToken, jobId),
    enabled: enabled && Boolean(scope.tenantId && jobId),
  });
}

function setJobWorkflowMutationState(
  queryClient: QueryClient,
  scope: QueryScope,
  result: JobStatusTransitionResult | JobCompletionReviewMutationResult,
) {
  queryClient.setQueryData(
    queryKeys.jobs.detail(scope, result.job.id),
    result.job,
  );
  queryClient.setQueryData<JobHistoryResult>(
    queryKeys.jobs.history(scope, result.job.id),
    (current) => ({
      history: [...(current?.history ?? []), result.historyEntry],
      allowedTransitions: result.allowedTransitions,
    }),
  );
}

function invalidateJobMutationState(
  queryClient: QueryClient,
  scope: QueryScope,
) {
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.jobs.all(scope),
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
      queryKey: queryKeys.customers.all(scope),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all(scope),
      refetchType: "none",
    }),
  ]);
}

export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, input: CreateJobInput) =>
      createJobRequest(accessToken, input),
    onSuccess: () => {
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type UpdateJobVariables = {
  jobId: string;
  input: UpdateJobInput;
};

export function useUpdateJobMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, { jobId, input }: UpdateJobVariables) =>
      updateJobRequest(accessToken, jobId, input),
    onSuccess: () => {
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type TransitionJobVariables = {
  jobId: string;
  input: JobStatusTransitionRequest;
};

export function useTransitionJobStatusMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, { jobId, input }: TransitionJobVariables) =>
      transitionJobStatusRequest(accessToken, jobId, input),
    onSuccess: (result) => {
      setJobWorkflowMutationState(queryClient, scope, result);
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type UploadJobEvidenceVariables = {
  jobId: string;
  input: UploadJobEvidenceInput;
};

export function useUploadJobEvidenceMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, { jobId, input }: UploadJobEvidenceVariables) =>
      uploadJobEvidenceRequest(accessToken, jobId, input),
    onSuccess: (created, { jobId }) => {
      queryClient.setQueryData<JobEvidenceItem[]>(
        queryKeys.jobs.evidence(scope, jobId),
        (current) => [created, ...(current ?? [])],
      );
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type DeleteJobEvidenceVariables = {
  jobId: string;
  evidenceId: string;
};

export function useDeleteJobEvidenceMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, { jobId, evidenceId }: DeleteJobEvidenceVariables) =>
      deleteJobEvidenceRequest(accessToken, jobId, evidenceId),
    onSuccess: (_, { jobId, evidenceId }) => {
      queryClient.setQueryData<JobEvidenceItem[]>(
        queryKeys.jobs.evidence(scope, jobId),
        (current) => current?.filter((item) => item.id !== evidenceId) ?? [],
      );
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type SubmitJobCompletionReviewVariables = {
  jobId: string;
  input: SubmitJobCompletionReviewRequest;
};

export function useSubmitJobCompletionReviewMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      { jobId, input }: SubmitJobCompletionReviewVariables,
    ) => submitJobCompletionReviewRequest(accessToken, jobId, input),
    onSuccess: (result) => {
      setJobWorkflowMutationState(queryClient, scope, result);
      queryClient.setQueryData(
        queryKeys.jobs.completionReview(scope, result.job.id),
        result.review,
      );
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type ApproveJobCompletionReviewVariables = {
  jobId: string;
  reviewId: string;
};

export function useApproveJobCompletionReviewMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      { jobId, reviewId }: ApproveJobCompletionReviewVariables,
    ) => approveJobCompletionReviewRequest(accessToken, jobId, reviewId),
    onSuccess: (result) => {
      setJobWorkflowMutationState(queryClient, scope, result);
      queryClient.setQueryData(
        queryKeys.jobs.completionReview(scope, result.job.id),
        result.review,
      );
      invalidateJobMutationState(queryClient, scope);
    },
  });
}

type ReturnJobCompletionReviewVariables = {
  jobId: string;
  reviewId: string;
  input: ReturnJobCompletionReviewRequest;
};

export function useReturnJobCompletionReviewMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      { jobId, reviewId, input }: ReturnJobCompletionReviewVariables,
    ) => returnJobCompletionReviewRequest(accessToken, jobId, reviewId, input),
    onSuccess: (result) => {
      setJobWorkflowMutationState(queryClient, scope, result);
      queryClient.setQueryData(
        queryKeys.jobs.completionReview(scope, result.job.id),
        result.review,
      );
      invalidateJobMutationState(queryClient, scope);
    },
  });
}
