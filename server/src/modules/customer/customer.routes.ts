import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
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

customerRouter.use(authenticate, requireTenantAccess);

customerRouter.get("/", listCustomersHandler);
customerRouter.post(
  "/",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  createCustomerHandler,
);
customerRouter.get("/:customerId", getCustomerDetailHandler);
customerRouter.post(
  "/:customerId/restore",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  restoreCustomerHandler,
);
customerRouter.patch(
  "/:customerId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  updateCustomerHandler,
);
customerRouter.delete(
  "/:customerId",
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  archiveCustomerHandler,
);

export { customerRouter };
