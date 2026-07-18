import {
  ToolInvocationSource,
  ToolInvocationStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { writeStructuredLog } from "../../lib/structured-log";

export type ToolInvocationAuditEvent = {
  tenantId: string;
  userId: string;
  source: ToolInvocationSource;
  invocationId: string;
  requestId?: string;
  conversationId?: string;
  toolName: string;
  status: ToolInvocationStatus;
  durationMs: number;
  errorCode?: string;
  proposalId?: string;
  inputKeys: string[];
  outputKeys: string[];
};

export type ToolInvocationRecorder = (
  event: ToolInvocationAuditEvent,
) => Promise<void>;

export async function recordToolInvocationSafe(
  event: ToolInvocationAuditEvent,
): Promise<void> {
  try {
    await prisma.toolInvocation.upsert({
      where: {
        tenantId_userId_source_invocationId: {
          tenantId: event.tenantId,
          userId: event.userId,
          source: event.source,
          invocationId: event.invocationId,
        },
      },
      create: {
        tenantId: event.tenantId,
        userId: event.userId,
        source: event.source,
        invocationId: event.invocationId,
        requestId: event.requestId,
        conversationId: event.conversationId,
        toolName: event.toolName,
        status: event.status,
        durationMs: event.durationMs,
        errorCode: event.errorCode,
        proposalId: event.proposalId,
        inputKeys: event.inputKeys,
        outputKeys: event.outputKeys,
      },
      update: {
        requestId: event.requestId,
        conversationId: event.conversationId,
        status: event.status,
        durationMs: event.durationMs,
        errorCode: event.errorCode,
        proposalId: event.proposalId,
        inputKeys: event.inputKeys,
        outputKeys: event.outputKeys,
      },
    });
  } catch (_error) {
    writeStructuredLog({
      level: "error",
      message: "Failed to persist tool invocation audit metadata.",
      source: event.source,
      toolName: event.toolName,
      invocationId: event.invocationId,
    });
  }
}
