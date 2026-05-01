import { JobStatus, MembershipRole } from "@prisma/client";
import {
  buildAgentRunTrace,
  buildProposalConfirmationTrace,
  logAiRunTrace,
} from "../src/modules/ai";
import type { AgentLoopResult } from "../src/modules/agent/agent-loop";
import type { ConfirmedProposalResult } from "../src/modules/agent/agent.service";
import type { AuthContext } from "../src/types/auth";
import { ApiError } from "../src/utils/api-error";

function buildAuth(): AuthContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    role: MembershipRole.MANAGER,
  };
}

describe("AI trace helpers", () => {
  const startedAt = new Date("2026-04-29T00:00:00.000Z");
  const completedAt = new Date("2026-04-29T00:00:02.500Z");

  it("builds agent run traces with usage and tool summaries only", () => {
    const result = {
      fullText: "Do not include this assistant text.",
      messages: [],
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      iterationCount: 2,
      tokenUsage: {
        inputTokens: 220,
        outputTokens: 25,
      },
      intentClassification: {
        intent: "SCHEDULE_JOB",
        confidence: 0.9,
        reason: "Private reason should not include values.",
        source: "merged",
        extracted: {
          customerQuery: "Private Customer",
          jobQuery: "Private job title",
          staffQuery: "Private Staff",
          jobConcepts: ["leak"],
        },
      },
      intentExtraction: {
        enabled: true,
        status: "succeeded",
        provider: "openai",
        model: "openai-test-model",
        durationMs: 120,
        tokenUsage: {
          inputTokens: 50,
          outputTokens: 10,
        },
        output: {
          intent: "SCHEDULE_JOB",
          confidence: 0.9,
          hasCustomerQuery: true,
          hasJobQuery: true,
          hasStaffQuery: true,
          hasTimeQuery: false,
          hasServiceAddress: false,
          hasCustomerFields: false,
          hasJobConcepts: true,
        },
      },
      toolCalls: [
        {
          name: "resolve_customer_target",
          input: { q: "Private Customer" },
          result: { status: "matched" },
        },
        {
          name: "save_typed_proposal",
          input: { customer: "Private Customer" },
          result: {
            error: true,
            message: "Tool input validation failed.",
          },
        },
      ],
      proposal: {
        id: "proposal-1",
        conversationId: "conversation-1",
        tenantId: "tenant-1",
        userId: "user-1",
        type: "SCHEDULE_JOB",
        intent: "schedule_job",
        customer: {
          status: "matched",
        },
        jobDraft: {
          title: "Private job title",
        },
        scheduleDraft: {
          timezone: "Australia/Adelaide",
        },
        warnings: [],
        confidence: 0.9,
        review: {
          status: "HAS_WARNINGS",
          blockers: [],
          warnings: ["Schedule conflict."],
        },
        createdAt: new Date("2026-04-29T00:00:01.000Z"),
      },
    } satisfies AgentLoopResult;

    const trace = buildAgentRunTrace({
      auth: buildAuth(),
      conversationId: "conversation-1",
      startedAt,
      completedAt,
      result,
    });

    expect(trace).toEqual(
      expect.objectContaining({
        workflowType: "CHAT_AGENT",
        status: "SUCCEEDED",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        durationMs: 2500,
        tokenUsage: {
          inputTokens: 220,
          outputTokens: 25,
        },
      }),
    );
    expect(trace.output).toEqual(
      expect.objectContaining({
        conversationId: "conversation-1",
        iterationCount: 2,
        toolCallCount: 2,
        toolNames: ["resolve_customer_target", "save_typed_proposal"],
        failedToolNames: ["save_typed_proposal"],
        intent: expect.objectContaining({
          intent: "SCHEDULE_JOB",
          source: "merged",
          extractor: expect.objectContaining({
            status: "succeeded",
            provider: "openai",
            model: "openai-test-model",
          }),
        }),
        proposalId: "proposal-1",
        proposalType: "SCHEDULE_JOB",
        proposalReviewStatus: "HAS_WARNINGS",
      }),
    );
    expect(JSON.stringify(trace)).not.toContain("Private Customer");
    expect(JSON.stringify(trace)).not.toContain("Private job title");
    expect(JSON.stringify(trace)).not.toContain("Private Staff");
    expect(JSON.stringify(trace)).not.toContain("assistant text");
  });

  it("builds failed agent run traces without requiring a result", () => {
    const trace = buildAgentRunTrace({
      auth: buildAuth(),
      conversationId: "conversation-1",
      startedAt,
      completedAt,
      error: new ApiError(503, "AI agent is not configured.", {
        code: "AI_NOT_CONFIGURED",
      }),
    });

    expect(trace.status).toBe("FAILED");
    expect(trace.error).toEqual({
      code: "AI_NOT_CONFIGURED",
      message: "AI agent is not configured.",
    });
    expect(trace.output).toEqual({
      conversationId: "conversation-1",
    });
  });

  it("builds proposal confirmation traces without customer or staff names", () => {
    const result = {
      proposalId: "proposal-1",
      proposalType: "SCHEDULE_JOB",
      entityType: "job",
      createdCustomerId: "customer-1",
      createdCustomerName: "Private Customer",
      createdJobId: "job-1",
      createdJobTitle: "Private Job",
      assignedToName: "Private Staff",
      transitionedTo: JobStatus.SCHEDULED,
    } satisfies ConfirmedProposalResult;

    const trace = buildProposalConfirmationTrace({
      auth: buildAuth(),
      conversationId: "conversation-1",
      proposalId: "proposal-1",
      startedAt,
      completedAt,
      result,
    });

    expect(trace.output).toEqual(
      expect.objectContaining({
        conversationId: "conversation-1",
        proposalId: "proposal-1",
        proposalType: "SCHEDULE_JOB",
        entityType: "job",
        createdCustomerId: "customer-1",
        createdJobId: "job-1",
        assigned: true,
        transitionedTo: JobStatus.SCHEDULED,
      }),
    );
    expect(JSON.stringify(trace)).not.toContain("Private Customer");
    expect(JSON.stringify(trace)).not.toContain("Private Job");
    expect(JSON.stringify(trace)).not.toContain("Private Staff");
  });

  it("logs successful traces to info and failed traces to error", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const successTrace = buildAgentRunTrace({
      auth: buildAuth(),
      conversationId: "conversation-1",
      startedAt,
      completedAt,
      result: {
        fullText: "",
        messages: [],
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        iterationCount: 1,
        toolCalls: [],
      },
    });
    const failedTrace = buildAgentRunTrace({
      auth: buildAuth(),
      conversationId: "conversation-1",
      startedAt,
      completedAt,
      error: new Error("Provider failed."),
    });

    logAiRunTrace("ai.agent.run.succeeded", successTrace);
    logAiRunTrace("ai.agent.run.failed", failedTrace);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"ai.agent.run.succeeded"'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"ai.agent.run.failed"'),
    );
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
