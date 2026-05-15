import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  createRateLimiter,
  tenantUserRateLimitKey,
} from "../../middleware/rate-limit";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  confirmProposalHandler,
  createConversationHandler,
  getConversationHandler,
  listConversationsHandler,
  sendMessageHandler,
  updateProposalReviewHandler,
} from "./agent.controller";

export const agentRouter = Router();

const agentMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: "Too many AI planner changes. Please try again later.",
  keyGenerator: tenantUserRateLimitKey("agent"),
});

agentRouter.use(authenticate, requireTenantAccess);

agentRouter.post("/conversations", agentMutationLimiter, createConversationHandler);
agentRouter.get("/conversations", listConversationsHandler);
agentRouter.get("/conversations/:conversationId", getConversationHandler);
agentRouter.post(
  "/conversations/:conversationId/messages",
  agentMutationLimiter,
  sendMessageHandler,
);
agentRouter.patch(
  "/conversations/:conversationId/proposals/:proposalId",
  agentMutationLimiter,
  updateProposalReviewHandler,
);
agentRouter.post(
  "/conversations/:conversationId/proposals/:proposalId/confirm",
  agentMutationLimiter,
  confirmProposalHandler,
);
