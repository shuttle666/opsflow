import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import { listActivityFeedHandler } from "./audit.controller";

const auditRouter = Router();

auditRouter.use(
  authenticate,
  requireTenantAccess,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
);
auditRouter.get("/", listActivityFeedHandler);

export { auditRouter };
