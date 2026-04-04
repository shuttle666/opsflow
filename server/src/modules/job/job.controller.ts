import type { RequestHandler } from "express";
import { z } from "zod";
import { getRequestMetadata } from "../auth/request-metadata";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  assignJobSchema,
  createJobSchema,
  jobIdParamSchema,
  jobListQuerySchema,
  scheduleDayQuerySchema,
  transitionJobStatusSchema,
  updateJobSchema,
} from "./job-schemas";
import {
  assignJob,
  checkScheduleConflicts,
  createJob,
  getScheduleDay,
  getJobDetail,
  getJobHistory,
  listJobs,
  listMyJobs,
  transitionJobStatusForActor,
  unassignJob,
  updateJob,
} from "./job.service";

export const listJobsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = jobListQuerySchema.parse(req.query);
  const result = await listJobs(req.auth, query);

  sendSuccess(res, {
    message: "Jobs loaded.",
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
});

export const createJobHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const input = createJobSchema.parse(req.body);
  const result = await createJob(req.auth, input);

  sendSuccess(res, {
    statusCode: 201,
    message: "Job created.",
    data: result,
  });
});

export const listMyJobsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = jobListQuerySchema.parse(req.query);
  const result = await listMyJobs(req.auth, query);

  sendSuccess(res, {
    message: "Assigned jobs loaded.",
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
});

export const getJobDetailHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const result = await getJobDetail(req.auth, jobId);

  sendSuccess(res, {
    message: "Job loaded.",
    data: result,
  });
});

export const getJobHistoryHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const result = await getJobHistory(req.auth, jobId);

  sendSuccess(res, {
    message: "Job history loaded.",
    data: result,
  });
});

export const getScheduleDayHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = scheduleDayQuerySchema.parse(req.query);
  const result = await getScheduleDay(req.auth, {
    ...query,
  });

  sendSuccess(res, {
    message: "Schedule loaded.",
    data: result,
  });
});

export const checkScheduleConflictsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const body = z
    .object({
      assigneeUserId: z.uuid(),
      scheduledStartAt: z.string().trim().datetime({ offset: true }),
      scheduledEndAt: z.string().trim().datetime({ offset: true }),
      excludeJobId: z.uuid().optional(),
    })
    .strict()
    .parse(req.body);

  const result = await checkScheduleConflicts(req.auth, body);

  sendSuccess(res, {
    message: "Schedule conflicts checked.",
    data: result,
  });
});

export const updateJobHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const input = updateJobSchema.parse(req.body);
  const result = await updateJob(req.auth, jobId, input);

  sendSuccess(res, {
    message: "Job updated.",
    data: result,
  });
});

export const assignJobHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const input = assignJobSchema.parse(req.body);
  const result = await assignJob(req.auth, jobId, input, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Job assigned.",
    data: result,
  });
});

export const unassignJobHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const result = await unassignJob(req.auth, jobId, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Job unassigned.",
    data: result,
  });
});

export const transitionJobStatusHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobIdParamSchema.parse(req.params);
  const input = transitionJobStatusSchema.parse(req.body);
  const result = await transitionJobStatusForActor(
    req.auth,
    jobId,
    input,
    getRequestMetadata(req),
  );

  sendSuccess(res, {
    message: "Job status transitioned.",
    data: result,
  });
});
