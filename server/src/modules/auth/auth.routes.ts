import { MembershipRole } from "@prisma/client";
import { Router } from "express";
import { env } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import {
  createRateLimiter,
  emailAndIpRateLimitKey,
  tenantUserRateLimitKey,
} from "../../middleware/rate-limit";
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
  privateDemoSessionHandler,
  refreshHandler,
  registerHandler,
  resendTenantInvitationHandler,
  switchTenantHandler,
} from "./auth.controller";

const authRouter = Router();
const tenantRouter = Router();
const invitationRouter = Router();

const authMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: "Too many authentication attempts. Please try again later.",
  keyGenerator: emailAndIpRateLimitKey,
});

const refreshLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many token refresh attempts. Please try again later.",
});

const privateDemoCreationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: env.DEMO_WORKSPACE_CREATE_LIMIT,
  message: "Too many quick demo requests. Please try again later.",
});

const invitationMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: "Too many invitation changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("invitations"),
});

authRouter.post("/register", authMutationLimiter, registerHandler);
authRouter.post("/login", authMutationLimiter, loginHandler);
authRouter.post(
  "/demo-session",
  privateDemoCreationLimiter,
  privateDemoSessionHandler,
);
authRouter.post("/refresh", refreshLimiter, refreshHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, requireTenantAccess, meHandler);
authRouter.post("/switch-tenant", authenticate, switchTenantHandler);

tenantRouter.post(
  "/:tenantId/invitations",
  authenticate,
  requireTenantAccess,
  invitationMutationLimiter,
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
  invitationMutationLimiter,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  resendTenantInvitationHandler,
);
tenantRouter.post(
  "/:tenantId/invitations/:invitationId/cancel",
  authenticate,
  requireTenantAccess,
  invitationMutationLimiter,
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER),
  cancelTenantInvitationHandler,
);

invitationRouter.post("/accept", authenticate, acceptInvitationHandler);
invitationRouter.get("/mine", authenticate, listMyInvitationsHandler);
invitationRouter.post("/:invitationId/accept", authenticate, acceptInvitationByIdHandler);

export { authRouter, invitationRouter, tenantRouter };
