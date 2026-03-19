import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  acceptInvitationHandler,
  createInvitationHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  switchTenantHandler,
} from "./auth.controller";

const authRouter = Router();
const tenantRouter = Router();
const invitationRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/refresh", refreshHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, requireTenantAccess, meHandler);
authRouter.post("/switch-tenant", authenticate, switchTenantHandler);

tenantRouter.post(
  "/:tenantId/invitations",
  authenticate,
  requireTenantAccess,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  createInvitationHandler,
);

invitationRouter.post("/accept", authenticate, acceptInvitationHandler);

export { authRouter, invitationRouter, tenantRouter };

