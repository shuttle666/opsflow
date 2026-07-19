import type { NextFunction, Request, Response } from "express";
import { MembershipRole } from "@prisma/client";

const controllerMocks = vi.hoisted(() => ({
  runAgentLoop: vi.fn(),
  assertAiAgentProfileConfigured: vi.fn(),
  buildAgentRunTrace: vi.fn(() => ({})),
  buildProposalConfirmationTrace: vi.fn(() => ({})),
  logAiRunTrace: vi.fn(),
  createConversation: vi.fn(),
  confirmDispatchProposal: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  addUserMessage: vi.fn(),
  appendAssistantMessage: vi.fn(),
  updateProposalReview: vi.fn(),
  revalidateAuth: vi.fn(async (auth) => auth),
  consumeDemoAiBudget: vi.fn(),
}));

vi.mock("../src/modules/auth/auth-context", () => ({
  revalidateTenantAuthContext: controllerMocks.revalidateAuth,
}));

vi.mock("../src/modules/demo-workspace/demo-workspace.service", () => ({
  consumePrivateDemoAiRequestBudget: controllerMocks.consumeDemoAiBudget,
}));

vi.mock("../src/modules/ai", () => ({
  assertAiAgentProfileConfigured:
    controllerMocks.assertAiAgentProfileConfigured,
  buildAgentRunTrace: controllerMocks.buildAgentRunTrace,
  buildProposalConfirmationTrace:
    controllerMocks.buildProposalConfirmationTrace,
  logAiRunTrace: controllerMocks.logAiRunTrace,
}));

vi.mock("../src/modules/agent/agent.service", () => ({
  createConversation: controllerMocks.createConversation,
  confirmDispatchProposal: controllerMocks.confirmDispatchProposal,
  getConversation: controllerMocks.getConversation,
  listConversations: controllerMocks.listConversations,
  addUserMessage: controllerMocks.addUserMessage,
  appendAssistantMessage: controllerMocks.appendAssistantMessage,
  updateProposalReview: controllerMocks.updateProposalReview,
}));

vi.mock("../src/modules/agent/agent-loop", () => ({
  runAgentLoop: controllerMocks.runAgentLoop,
}));

import { sendMessageHandler } from "../src/modules/agent/agent.controller";

describe("sendMessageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates the HTTP request ID and returns it in an SSE error", async () => {
    const conversationId = "00000000-0000-4000-8000-000000000001";
    const requestId = "web-agent-request-123";
    controllerMocks.getConversation.mockResolvedValue({
      claudeMessages: [{ role: "user", content: "Schedule the job" }],
    });
    controllerMocks.addUserMessage.mockResolvedValue(undefined);
    controllerMocks.runAgentLoop.mockRejectedValue(
      new Error("AI provider unavailable"),
    );

    const req = {
      auth: {
        userId: "user-1",
        sessionId: "session-1",
        tenantId: "tenant-1",
        role: MembershipRole.MANAGER,
      },
      requestId,
      params: { conversationId },
      body: {
        content: "Schedule the job",
        timezone: "Australia/Adelaide",
      },
    } as unknown as Request;

    let resolveCompleted: () => void;
    let rejectCompleted: (error: unknown) => void;
    const completed = new Promise<void>((resolve, reject) => {
      resolveCompleted = resolve;
      rejectCompleted = reject;
    });
    const res = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(() => resolveCompleted()),
    } as unknown as Response;
    const next = vi.fn((error?: unknown) => {
      if (error) {
        rejectCompleted(error);
      } else {
        resolveCompleted();
      }
    }) as NextFunction;

    sendMessageHandler(req, res, next);
    await completed;

    expect(controllerMocks.runAgentLoop).toHaveBeenCalledWith(
      expect.any(Array),
      req.auth,
      {
        conversationId,
        timezone: "Australia/Adelaide",
        requestId,
      },
      expect.any(Object),
    );
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: "error",
        message: "AI provider unavailable",
        requestId,
      })}\n\n`,
    );
    expect(res.write).toHaveBeenLastCalledWith(
      `data: ${JSON.stringify({ type: "done" })}\n\n`,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
