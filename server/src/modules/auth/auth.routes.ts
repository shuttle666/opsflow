import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  acceptInvitationByIdHandler,
  acceptInvitationHandler,
  cancelTenantInvitationHandler,
  createInvitationHandler,
  listMyInvitationsHandler,
  listTenantInvitationsHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resendTenantInvitationHandler,
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
tenantRouter.get(
  "/:tenantId/invitations",
  authenticate,
  requireTenantAccess,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  listTenantInvitationsHandler,
);
tenantRouter.post(
  "/:tenantId/invitations/:invitationId/resend",
  authenticate,
  requireTenantAccess,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  resendTenantInvitationHandler,
);
tenantRouter.post(
  "/:tenantId/invitations/:invitationId/cancel",
  authenticate,
  requireTenantAccess,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  cancelTenantInvitationHandler,
);

invitationRouter.post("/accept", authenticate, acceptInvitationHandler);
invitationRouter.get("/mine", authenticate, listMyInvitationsHandler);
invitationRouter.post("/:invitationId/accept", authenticate, acceptInvitationByIdHandler);

export { authRouter, invitationRouter, tenantRouter };
