import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
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

agentRouter.use(authenticate, requireTenantAccess);

agentRouter.post("/conversations", createConversationHandler);
agentRouter.get("/conversations", listConversationsHandler);
agentRouter.get("/conversations/:conversationId", getConversationHandler);
agentRouter.post("/conversations/:conversationId/messages", sendMessageHandler);
agentRouter.patch(
  "/conversations/:conversationId/proposals/:proposalId",
  updateProposalReviewHandler,
);
agentRouter.post(
  "/conversations/:conversationId/proposals/:proposalId/confirm",
  confirmProposalHandler,
);
