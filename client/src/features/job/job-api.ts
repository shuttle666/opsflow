import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type { PaginationMeta } from "@/types/customer";
import type {
  AssignJobRequest,
  CreateJobInput,
  JobCompletionReviewItem,
  JobCompletionReviewMutationResult,
  JobDetail,
  JobEvidenceItem,
  JobHistoryResult,
  JobListItem,
  JobListQuery,
  ScheduleConflictCheckResult,
  ScheduleDayResult,
  ScheduleRangeResult,
  JobStatusTransitionRequest,
  JobStatusTransitionResult,
  ReturnJobCompletionReviewRequest,
  SubmitJobCompletionReviewRequest,
  UploadJobEvidenceInput,
  UpdateJobInput,
} from "@/types/job";

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

function buildJobsQuery(query: JobListQuery) {
  const params = new URLSearchParams();

  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.customerId) {
    params.set("customerId", query.customerId);
  }
  if (query.scheduledFrom) {
    params.set("scheduledFrom", query.scheduledFrom);
  }
  if (query.scheduledTo) {
    params.set("scheduledTo", query.scheduledTo);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listJobsRequest(accessToken: string, query: JobListQuery) {
  const response = await apiClient.get<ApiSuccessResponse<JobListItem[]>>(
    `/jobs${buildJobsQuery(query)}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Job list response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)
      ?.pagination ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      total: 0,
      totalPages: 1,
    }) satisfies PaginationMeta,
  };
}

export async function createJobRequest(
  accessToken: string,
  input: CreateJobInput,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobListItem>>(
    "/jobs",
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Create job response is missing payload.");
}

export async function listMyJobsRequest(accessToken: string, query: JobListQuery) {
  const response = await apiClient.get<ApiSuccessResponse<JobListItem[]>>(
    `/jobs/my${buildJobsQuery(query)}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Assigned job list response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)
      ?.pagination ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      total: 0,
      totalPages: 1,
    }) satisfies PaginationMeta,
  };
}

export async function getJobDetailRequest(
  accessToken: string,
  jobId: string,
) {
  const response = await apiClient.get<ApiSuccessResponse<JobDetail>>(
    `/jobs/${jobId}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Job detail response is missing payload.");
}

export async function getJobHistoryRequest(
  accessToken: string,
  jobId: string,
) {
  const response = await apiClient.get<ApiSuccessResponse<JobHistoryResult>>(
    `/jobs/${jobId}/history`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Job history response is missing payload.");
}

export async function updateJobRequest(
  accessToken: string,
  jobId: string,
  input: UpdateJobInput,
) {
  const response = await apiClient.patch<ApiSuccessResponse<JobListItem>>(
    `/jobs/${jobId}`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Update job response is missing payload.");
}

export async function assignJobRequest(
  accessToken: string,
  jobId: string,
  input: AssignJobRequest,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobDetail>>(
    `/jobs/${jobId}/assign`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Assign job response is missing payload.");
}

export async function unassignJobRequest(accessToken: string, jobId: string) {
  const response = await apiClient.post<ApiSuccessResponse<JobDetail>>(
    `/jobs/${jobId}/unassign`,
    undefined,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Unassign job response is missing payload.");
}

export async function transitionJobStatusRequest(
  accessToken: string,
  jobId: string,
  input: JobStatusTransitionRequest,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobStatusTransitionResult>>(
    `/jobs/${jobId}/status-transitions`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Job status transition response is missing payload.");
}

export async function getLatestJobCompletionReviewRequest(
  accessToken: string,
  jobId: string,
) {
  const response = await apiClient.get<ApiSuccessResponse<JobCompletionReviewItem | null>>(
    `/jobs/${jobId}/completion-review`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Completion review response is missing payload.");
}

export async function submitJobCompletionReviewRequest(
  accessToken: string,
  jobId: string,
  input: SubmitJobCompletionReviewRequest,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobCompletionReviewMutationResult>>(
    `/jobs/${jobId}/completion-review`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Submit completion review response is missing payload.");
}

export async function approveJobCompletionReviewRequest(
  accessToken: string,
  jobId: string,
  reviewId: string,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobCompletionReviewMutationResult>>(
    `/jobs/${jobId}/completion-review/${reviewId}/approve`,
    undefined,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Approve completion review response is missing payload.");
}

export async function returnJobCompletionReviewRequest(
  accessToken: string,
  jobId: string,
  reviewId: string,
  input: ReturnJobCompletionReviewRequest,
) {
  const response = await apiClient.post<ApiSuccessResponse<JobCompletionReviewMutationResult>>(
    `/jobs/${jobId}/completion-review/${reviewId}/return`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Return completion review response is missing payload.");
}

export async function listJobEvidenceRequest(accessToken: string, jobId: string) {
  const response = await apiClient.get<ApiSuccessResponse<JobEvidenceItem[]>>(
    `/jobs/${jobId}/evidence`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Job evidence response is missing payload.");
}

export async function uploadJobEvidenceRequest(
  accessToken: string,
  jobId: string,
  input: UploadJobEvidenceInput,
) {
  const formData = new FormData();
  formData.set("kind", input.kind);
  if (input.note?.trim()) {
    formData.set("note", input.note.trim());
  }
  formData.set("file", input.file);

  const response = await apiClient.postForm<ApiSuccessResponse<JobEvidenceItem>>(
    `/jobs/${jobId}/evidence`,
    formData,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Upload job evidence response is missing payload.");
}

export async function deleteJobEvidenceRequest(
  accessToken: string,
  jobId: string,
  evidenceId: string,
) {
  await apiClient.delete<ApiSuccessResponse<undefined>>(
    `/jobs/${jobId}/evidence/${evidenceId}`,
    {
      headers: authHeader(accessToken),
    },
  );
}

export async function downloadJobEvidenceRequest(
  accessToken: string,
  jobId: string,
  evidenceId: string,
) {
  return apiClient.getBlob(`/jobs/${jobId}/evidence/${evidenceId}/download`, {
    headers: authHeader(accessToken),
  });
}

export async function getScheduleDayRequest(
  accessToken: string,
  input: {
    date: string;
    assigneeId?: string;
    timezoneOffsetMinutes?: number;
  },
) {
  const params = new URLSearchParams();
  params.set("date", input.date);
  if (input.assigneeId) {
    params.set("assigneeId", input.assigneeId);
  }
  if (input.timezoneOffsetMinutes !== undefined) {
    params.set("timezoneOffsetMinutes", String(input.timezoneOffsetMinutes));
  }

  const response = await apiClient.get<ApiSuccessResponse<ScheduleDayResult>>(
    `/jobs/schedule/day?${params.toString()}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Schedule day response is missing payload.");
}

export async function getScheduleRangeRequest(
  accessToken: string,
  input: {
    rangeStart: string;
    rangeEnd: string;
    assigneeId?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("rangeStart", input.rangeStart);
  params.set("rangeEnd", input.rangeEnd);
  if (input.assigneeId) {
    params.set("assigneeId", input.assigneeId);
  }

  const response = await apiClient.get<ApiSuccessResponse<ScheduleRangeResult>>(
    `/jobs/schedule/range?${params.toString()}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Schedule range response is missing payload.");
}

export async function checkScheduleConflictsRequest(
  accessToken: string,
  input: {
    assigneeUserId: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
    excludeJobId?: string;
  },
) {
  const response = await apiClient.post<ApiSuccessResponse<ScheduleConflictCheckResult>>(
    "/jobs/schedule/conflicts",
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Schedule conflict response is missing payload.");
}
