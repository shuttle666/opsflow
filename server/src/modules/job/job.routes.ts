import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  assignJobHandler,
  createJobHandler,
  getJobDetailHandler,
  getJobHistoryHandler,
  listJobsHandler,
  listMyJobsHandler,
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
jobRouter.get("/my", listMyJobsHandler);
jobRouter.post(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  createJobHandler,
);
jobRouter.get("/:jobId", getJobDetailHandler);
jobRouter.get("/:jobId/history", getJobHistoryHandler);
jobRouter.post("/:jobId/status-transitions", transitionJobStatusHandler);
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
