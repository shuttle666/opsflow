import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  listMembershipsHandler,
  updateMembershipHandler,
} from "./membership.controller";

const membershipRouter = Router();

membershipRouter.use(authenticate, requireTenantAccess);

membershipRouter.get(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  listMembershipsHandler,
);
membershipRouter.patch(
  "/:membershipId",
  requireRole(MembershipRole.OWNER),
  updateMembershipHandler,
);

export { membershipRouter };
