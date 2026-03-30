import type { RequestHandler } from "express";
import { getRequestMetadata } from "../auth/request-metadata";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  jobEvidenceItemParamsSchema,
  jobEvidenceParamsSchema,
  uploadJobEvidenceBodySchema,
} from "./evidence-schemas";
import {
  deleteJobEvidence,
  getJobEvidenceDownload,
  listJobEvidence,
  uploadJobEvidence,
} from "./evidence.service";

export const listJobEvidenceHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobEvidenceParamsSchema.parse(req.params);
  const result = await listJobEvidence(req.auth, jobId);

  sendSuccess(res, {
    message: "Job evidence loaded.",
    data: result,
  });
});

export const uploadJobEvidenceHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId } = jobEvidenceParamsSchema.parse(req.params);
  const input = uploadJobEvidenceBodySchema.parse(req.body);

  if (!req.file) {
    throw new ApiError(400, "Evidence file is required.");
  }

  const result = await uploadJobEvidence(
    req.auth,
    jobId,
    {
      ...input,
      file: req.file,
    },
    getRequestMetadata(req),
  );

  sendSuccess(res, {
    statusCode: 201,
    message: "Job evidence uploaded.",
    data: result,
  });
});

export const deleteJobEvidenceHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId, evidenceId } = jobEvidenceItemParamsSchema.parse(req.params);
  await deleteJobEvidence(req.auth, jobId, evidenceId, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Job evidence deleted.",
  });
});

export const downloadJobEvidenceHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { jobId, evidenceId } = jobEvidenceItemParamsSchema.parse(req.params);
  const result = await getJobEvidenceDownload(req.auth, jobId, evidenceId);

  res.setHeader("Content-Type", result.mimeType);
  return res.download(result.absolutePath, result.fileName);
});
