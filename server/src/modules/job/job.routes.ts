import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
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
  checkScheduleConflictsHandler,
);
jobRouter.get("/my", listMyJobsHandler);
jobRouter.post(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  createJobHandler,
);
jobRouter.use("/:jobId/evidence", evidenceRouter);
jobRouter.get("/:jobId/completion-review", getLatestJobCompletionReviewHandler);
jobRouter.post("/:jobId/completion-review", submitJobCompletionReviewHandler);
jobRouter.post(
  "/:jobId/completion-review/:reviewId/approve",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  approveJobCompletionReviewHandler,
);
jobRouter.post(
  "/:jobId/completion-review/:reviewId/return",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  returnJobCompletionReviewHandler,
);
jobRouter.get("/:jobId", getJobDetailHandler);
jobRouter.get("/:jobId/history", getJobHistoryHandler);
jobRouter.post(
  "/:jobId/status-transitions",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  transitionJobStatusHandler,
);
jobRouter.post(
  "/:jobId/assign",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  assignJobHandler,
);
jobRouter.post(
  "/:jobId/unassign",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  unassignJobHandler,
);
jobRouter.patch(
  "/:jobId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  updateJobHandler,
);

export { jobRouter };
