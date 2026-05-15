import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  createRateLimiter,
  tenantUserRateLimitKey,
} from "../../middleware/rate-limit";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  listMembershipsHandler,
  updateMembershipHandler,
} from "./membership.controller";

const membershipRouter = Router();

const membershipMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: "Too many membership changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("memberships"),
});

membershipRouter.use(authenticate, requireTenantAccess);

membershipRouter.get(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  listMembershipsHandler,
);
membershipRouter.patch(
  "/:membershipId",
  requireRole(MembershipRole.OWNER),
  membershipMutationLimiter,
  updateMembershipHandler,
);

export { membershipRouter };
