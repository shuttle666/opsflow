import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import type { AgentLoopResult } from "../agent/agent-loop";
import type { ConfirmedProposalResult } from "../agent/agent.service";
import type { AiRunTrace, AiWorkflowType } from "./ai-trace.types";

type TraceStatus = "SUCCEEDED" | "FAILED";

type AgentRunTraceInput = {
  auth: AuthContext;
  conversationId: string;
  startedAt: Date;
  completedAt?: Date;
  result?: AgentLoopResult;
  error?: unknown;
};

type ProposalConfirmationTraceInput = {
  auth: AuthContext;
  conversationId: string;
  proposalId: string;
  startedAt: Date;
  completedAt?: Date;
  result?: ConfirmedProposalResult;
  error?: unknown;
};

function durationMs(startedAt: Date, completedAt: Date) {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function errorCode(error: unknown) {
  if (error instanceof ApiError) {
    const details = error.details;
    if (details && typeof details === "object" && "code" in details) {
      const code = (details as { code?: unknown }).code;
      if (typeof code === "string") {
        return code;
      }
    }

    return String(error.statusCode);
  }

  return error instanceof Error ? error.name : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function isToolErrorResult(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "error" in value &&
      (value as { error?: unknown }).error === true,
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function toolSummary(toolCalls: AgentLoopResult["toolCalls"]) {
  const toolNames = toolCalls.map((toolCall) => toolCall.name);
  const failedToolNames = toolCalls
    .filter((toolCall) => isToolErrorResult(toolCall.result))
    .map((toolCall) => toolCall.name);

  return {
    toolCallCount: toolCalls.length,
    toolNames: uniqueValues(toolNames),
    failedToolNames: uniqueValues(failedToolNames),
  };
}

function intentSummary(result: AgentLoopResult | undefined) {
  if (!result?.intentClassification && !result?.intentExtraction) {
    return undefined;
  }

  const classification = result.intentClassification;
  const extraction = result.intentExtraction;

  return {
    ...(classification
      ? {
          intent: classification.intent,
          confidence: classification.confidence,
          source: classification.source,
          extractedFieldPresence: {
            hasCustomerQuery: Boolean(classification.extracted.customerQuery),
            hasJobQuery: Boolean(classification.extracted.jobQuery),
            hasStaffQuery: Boolean(classification.extracted.staffQuery),
            hasTimeQuery: Boolean(classification.extracted.timeQuery),
            hasServiceAddress: Boolean(classification.extracted.serviceAddress),
            hasCustomerFields: Boolean(
              classification.extracted.customerFields &&
                Object.values(classification.extracted.customerFields).some(Boolean),
            ),
            hasJobConcepts: Boolean(classification.extracted.jobConcepts?.length),
          },
        }
      : {}),
    ...(extraction
      ? {
          extractor: extraction,
        }
      : {}),
  };
}

function buildBaseTrace(input: {
  auth: AuthContext;
  workflowType: AiWorkflowType;
  status: TraceStatus;
  startedAt: Date;
  completedAt?: Date;
  provider?: string;
  model?: string;
  output?: unknown;
  error?: unknown;
}): AiRunTrace & {
  tenantId: string;
  userId: string;
  sessionId: string;
} {
  const completedAt = input.completedAt ?? new Date();

  return {
    workflowType: input.workflowType,
    status: input.status,
    tenantId: input.auth.tenantId,
    userId: input.auth.userId,
    sessionId: input.auth.sessionId,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    startedAt: input.startedAt,
    completedAt,
    durationMs: durationMs(input.startedAt, completedAt),
    ...(input.output ? { output: input.output } : {}),
    ...(input.error
      ? {
          error: {
            ...(errorCode(input.error) ? { code: errorCode(input.error) } : {}),
            message: errorMessage(input.error),
          },
        }
      : {}),
  };
}

export function buildAgentRunTrace(input: AgentRunTraceInput): AiRunTrace & {
  tenantId: string;
  userId: string;
  sessionId: string;
} {
  const status: TraceStatus = input.error ? "FAILED" : "SUCCEEDED";
  const proposal = input.result?.proposal;
  const intent = intentSummary(input.result);
  const output = input.result
    ? {
        conversationId: input.conversationId,
        iterationCount: input.result.iterationCount,
        ...toolSummary(input.result.toolCalls),
        ...(intent ? { intent } : {}),
        ...(proposal
          ? {
              proposalId: proposal.id,
              proposalType: proposal.type ?? proposal.intent,
              proposalReviewStatus: proposal.review?.status,
            }
          : {}),
      }
    : {
        conversationId: input.conversationId,
      };

  return {
    ...buildBaseTrace({
      auth: input.auth,
      workflowType: "CHAT_AGENT",
      status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      provider: input.result?.provider,
      model: input.result?.model,
      output,
      error: input.error,
    }),
    ...(input.result?.tokenUsage ? { tokenUsage: input.result.tokenUsage } : {}),
  };
}

export function buildProposalConfirmationTrace(
  input: ProposalConfirmationTraceInput,
): AiRunTrace & {
  tenantId: string;
  userId: string;
  sessionId: string;
} {
  const status: TraceStatus = input.error ? "FAILED" : "SUCCEEDED";

  return buildBaseTrace({
    auth: input.auth,
    workflowType: "CHAT_AGENT",
    status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    output: {
      conversationId: input.conversationId,
      proposalId: input.proposalId,
      ...(input.result
        ? {
            proposalType: input.result.proposalType,
            entityType: input.result.entityType,
            createdCustomerId: input.result.createdCustomerId,
            updatedCustomerId: input.result.updatedCustomerId,
            createdJobId: input.result.createdJobId,
            updatedExistingJob: input.result.updatedExistingJob,
            assigned: Boolean(input.result.assignedToName),
            transitionedTo: input.result.transitionedTo,
          }
        : {}),
    },
    error: input.error,
  });
}

export function logAiRunTrace(event: string, trace: AiRunTrace): void {
  const serialized = JSON.stringify({
    event,
    ...trace,
  });

  if (trace.status === "FAILED") {
    console.error(serialized);
    return;
  }

  console.info(serialized);
}
