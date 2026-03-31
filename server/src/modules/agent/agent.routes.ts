import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  createConversationHandler,
  getConversationHandler,
  listConversationsHandler,
  sendMessageHandler,
} from "./agent.controller";

export const agentRouter = Router();

agentRouter.use(authenticate, requireTenantAccess);

agentRouter.post("/conversations", createConversationHandler);
agentRouter.get("/conversations", listConversationsHandler);
agentRouter.get("/conversations/:conversationId", getConversationHandler);
agentRouter.post("/conversations/:conversationId/messages", sendMessageHandler);
