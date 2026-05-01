import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import { getDashboardSummaryHandler } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.use(authenticate, requireTenantAccess);

dashboardRouter.get(
  "/summary",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF),
  getDashboardSummaryHandler,
);

export { dashboardRouter };
