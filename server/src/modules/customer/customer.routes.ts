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
  archiveCustomerHandler,
  createCustomerHandler,
  getCustomerDetailHandler,
  listCustomersHandler,
  restoreCustomerHandler,
  updateCustomerHandler,
} from "./customer.controller";

const customerRouter = Router();

const customerMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 120,
  message: "Too many customer changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("customers"),
});

customerRouter.use(authenticate, requireTenantAccess);

customerRouter.get("/", listCustomersHandler);
customerRouter.post(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  customerMutationLimiter,
  createCustomerHandler,
);
customerRouter.get("/:customerId", getCustomerDetailHandler);
customerRouter.post(
  "/:customerId/restore",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  customerMutationLimiter,
  restoreCustomerHandler,
);
customerRouter.patch(
  "/:customerId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  customerMutationLimiter,
  updateCustomerHandler,
);
customerRouter.delete(
  "/:customerId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  customerMutationLimiter,
  archiveCustomerHandler,
);

export { customerRouter };
