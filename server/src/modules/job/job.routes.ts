import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  createRateLimiter,
  tenantUserRateLimitKey,
} from "../../middleware/rate-limit";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import { evidenceRouter } from "../evidence/evidence.routes";
import {
  approveJobCompletionReviewHandler,
  assignJobHandler,
  checkScheduleConflictsHandler,
  createJobHandler,
  getLatestJobCompletionReviewHandler,
  getScheduleDayHandler,
  getScheduleRangeHandler,
  getJobDetailHandler,
  getJobHistoryHandler,
  listJobsHandler,
  listMyJobsHandler,
  returnJobCompletionReviewHandler,
  submitJobCompletionReviewHandler,
  transitionJobStatusHandler,
  unassignJobHandler,
  updateJobHandler,
} from "./job.controller";

const jobRouter = Router();

const jobMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 120,
  message: "Too many job changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("jobs"),
});

const completionReviewMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: "Too many completion review changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("completion-review"),
});

jobRouter.use(authenticate, requireTenantAccess);

jobRouter.get(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  listJobsHandler,
);
jobRouter.get(
  "/schedule/day",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF),
  getScheduleDayHandler,
);
jobRouter.get(
  "/schedule/range",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF),
  getScheduleRangeHandler,
);
jobRouter.post(
  "/schedule/conflicts",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  jobMutationLimiter,
  checkScheduleConflictsHandler,
);
jobRouter.get("/my", listMyJobsHandler);
jobRouter.post(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  jobMutationLimiter,
  createJobHandler,
);
jobRouter.use("/:jobId/evidence", evidenceRouter);
jobRouter.get("/:jobId/completion-review", getLatestJobCompletionReviewHandler);
jobRouter.post(
  "/:jobId/completion-review",
  completionReviewMutationLimiter,
  submitJobCompletionReviewHandler,
);
jobRouter.post(
  "/:jobId/completion-review/:reviewId/approve",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  completionReviewMutationLimiter,
  approveJobCompletionReviewHandler,
);
jobRouter.post(
  "/:jobId/completion-review/:reviewId/return",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  completionReviewMutationLimiter,
  returnJobCompletionReviewHandler,
);
jobRouter.get("/:jobId", getJobDetailHandler);
jobRouter.get("/:jobId/history", getJobHistoryHandler);
jobRouter.post(
  "/:jobId/status-transitions",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF),
  jobMutationLimiter,
  transitionJobStatusHandler,
);
jobRouter.post(
  "/:jobId/assign",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  jobMutationLimiter,
  assignJobHandler,
);
jobRouter.post(
  "/:jobId/unassign",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  jobMutationLimiter,
  unassignJobHandler,
);
jobRouter.patch(
  "/:jobId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  jobMutationLimiter,
  updateJobHandler,
);

export { jobRouter };
