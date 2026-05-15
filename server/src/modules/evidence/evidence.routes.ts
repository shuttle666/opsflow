import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env";
import {
  createRateLimiter,
  tenantUserRateLimitKey,
} from "../../middleware/rate-limit";
import {
  deleteJobEvidenceHandler,
  downloadJobEvidenceHandler,
  listJobEvidenceHandler,
  uploadJobEvidenceHandler,
} from "./evidence.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.EVIDENCE_MAX_SIZE_BYTES,
    files: 1,
  },
});

const evidenceRouter = Router({ mergeParams: true });

const evidenceMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: "Too many evidence changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("evidence"),
});

evidenceRouter.get("/", listJobEvidenceHandler);
evidenceRouter.post("/", evidenceMutationLimiter, upload.single("file"), uploadJobEvidenceHandler);
evidenceRouter.get("/:evidenceId/download", downloadJobEvidenceHandler);
evidenceRouter.delete("/:evidenceId", evidenceMutationLimiter, deleteJobEvidenceHandler);

export { evidenceRouter };
