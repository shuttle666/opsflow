import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type { PaginationMeta } from "@/types/customer";
import type {
  AssignJobRequest,
  CreateJobInput,
  JobDetail,
  JobEvidenceItem,
  JobHistoryResult,
  JobListItem,
  JobListQuery,
  JobStatusTransitionRequest,
  JobStatusTransitionResult,
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
