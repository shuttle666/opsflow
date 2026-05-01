import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  assertAiAgentProfileConfigured,
  buildAgentRunTrace,
  buildProposalConfirmationTrace,
  logAiRunTrace,
} from "../ai";
import {
  conversationIdParamSchema,
  proposalIdParamSchema,
  sendMessageSchema,
  updateProposalReviewSchema,
} from "./agent-schemas";
import {
  createConversation,
  confirmDispatchProposal,
  getConversation,
  listConversations,
  addUserMessage,
  appendAssistantMessage,
  updateProposalReview,
} from "./agent.service";
import { runAgentLoop, type AgentLoopResult } from "./agent-loop";

export const createConversationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) throw new ApiError(401, "Authentication is required.");
    assertAiAgentProfileConfigured("dispatch_planner");

    const conversation = await createConversation(req.auth);
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

    const conversations = await listConversations(req.auth);
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
    const conversation = await getConversation(req.auth, conversationId);

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
    assertAiAgentProfileConfigured("dispatch_planner");

    const { conversationId } = conversationIdParamSchema.parse(req.params);
    const { content, timezone } = sendMessageSchema.parse(req.body);

    const conversation = await getConversation(req.auth, conversationId);
    if (!conversation) throw new ApiError(404, "Conversation not found.");

    await addUserMessage(req.auth, conversationId, content);

    const updatedConversation = await getConversation(req.auth, conversationId);
    if (!updatedConversation) throw new ApiError(404, "Conversation not found.");

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const auth = req.auth;
    const traceStartedAt = new Date();
    let agentResult: AgentLoopResult | undefined;

    try {
      agentResult = await runAgentLoop(
        updatedConversation.claudeMessages,
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

      await appendAssistantMessage(
        conversationId,
        agentResult.fullText,
        agentResult.messages,
        agentResult.toolCalls,
      );
      logAiRunTrace(
        "ai.agent.run.succeeded",
        buildAgentRunTrace({
          auth,
          conversationId,
          startedAt: traceStartedAt,
          completedAt: new Date(),
          result: agentResult,
        }),
      );
    } catch (error) {
      logAiRunTrace(
        "ai.agent.run.failed",
        buildAgentRunTrace({
          auth,
          conversationId,
          startedAt: traceStartedAt,
          completedAt: new Date(),
          result: agentResult,
          error,
        }),
      );
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
  const traceStartedAt = new Date();

  try {
    const result = await confirmDispatchProposal(req.auth, conversationId, proposalId);

    logAiRunTrace(
      "ai.proposal.confirm.succeeded",
      buildProposalConfirmationTrace({
        auth: req.auth,
        conversationId,
        proposalId,
        startedAt: traceStartedAt,
        completedAt: new Date(),
        result,
      }),
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Dispatch proposal confirmed.",
      data: result,
    });
  } catch (error) {
    logAiRunTrace(
      "ai.proposal.confirm.failed",
      buildProposalConfirmationTrace({
        auth: req.auth,
        conversationId,
        proposalId,
        startedAt: traceStartedAt,
        completedAt: new Date(),
        error,
      }),
    );
    throw error;
  }
});

export const updateProposalReviewHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) throw new ApiError(401, "Authentication is required.");

  const { conversationId, proposalId } = proposalIdParamSchema.parse(req.params);
  const input = updateProposalReviewSchema.parse(req.body);

  const proposal = await updateProposalReview(req.auth, conversationId, proposalId, input);

  sendSuccess(res, {
    message: "Dispatch proposal updated.",
    data: proposal,
  });
});
