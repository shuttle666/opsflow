import type { RequestHandler } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  conversationIdParamSchema,
  proposalIdParamSchema,
  sendMessageSchema,
} from "./agent-schemas";
import {
  createConversation,
  confirmDispatchProposal,
  getConversation,
  listConversations,
  addUserMessage,
  appendAssistantMessage,
} from "./agent.service";
import { runAgentLoop } from "./agent-loop";

export const createConversationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) throw new ApiError(401, "Authentication is required.");
    if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, "AI agent is not configured.");

    const conversation = createConversation(req.auth);
    sendSuccess(res, {
      statusCode: 201,
      message: "Conversation created.",
      data: {
        id: conversation.id,
        createdAt: conversation.createdAt,
      },
    });
  },
);

export const listConversationsHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) throw new ApiError(401, "Authentication is required.");

    const conversations = listConversations(req.auth);
    sendSuccess(res, {
      message: "Conversations retrieved.",
      data: conversations,
    });
  },
);

export const getConversationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) throw new ApiError(401, "Authentication is required.");

    const { conversationId } = conversationIdParamSchema.parse(req.params);
    const conversation = getConversation(req.auth, conversationId);

    if (!conversation) throw new ApiError(404, "Conversation not found.");

    sendSuccess(res, {
      message: "Conversation retrieved.",
      data: {
        id: conversation.id,
        messages: conversation.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  },
);

export const sendMessageHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) throw new ApiError(401, "Authentication is required.");
    if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, "AI agent is not configured.");

    const { conversationId } = conversationIdParamSchema.parse(req.params);
    const { content, timezone } = sendMessageSchema.parse(req.body);

    const conversation = getConversation(req.auth, conversationId);
    if (!conversation) throw new ApiError(404, "Conversation not found.");

    addUserMessage(req.auth, conversationId, content);

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const auth = req.auth;

    try {
      const result = await runAgentLoop(
        conversation.claudeMessages,
        auth,
        {
          conversationId,
          timezone,
        },
        {
          onTextDelta: (text) => {
            res.write(`data: ${JSON.stringify({ type: "text_delta", text })}\n\n`);
          },
          onToolUse: (toolName, input) => {
            res.write(
              `data: ${JSON.stringify({ type: "tool_use", tool: toolName, input })}\n\n`,
            );
          },
          onToolResult: (toolName, result) => {
            res.write(
              `data: ${JSON.stringify({ type: "tool_result", tool: toolName, result })}\n\n`,
            );
          },
          onProposal: (proposal) => {
            res.write(
              `data: ${JSON.stringify({ type: "proposal", proposal })}\n\n`,
            );
          },
        },
      );

      appendAssistantMessage(
        conversationId,
        result.fullText,
        result.messages,
        result.toolCalls,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  },
);

export const confirmProposalHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) throw new ApiError(401, "Authentication is required.");

  const { conversationId, proposalId } = proposalIdParamSchema.parse(req.params);

  const result = await confirmDispatchProposal(req.auth, conversationId, proposalId);

  sendSuccess(res, {
    statusCode: 201,
    message: "Dispatch proposal confirmed.",
    data: result,
  });
});
