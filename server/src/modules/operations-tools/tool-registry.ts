import type { AuthContext } from "../../types/auth";
import { ToolInvocationStatus } from "@prisma/client";
import {
  formatToolSchemaError,
  normalizeToolError,
} from "./tool-errors";
import type {
  ToolInvocationAuditEvent,
  ToolInvocationRecorder,
} from "./tool-invocation-audit";
import type {
  AnyOpsFlowTool,
  ToolAudience,
  ToolErrorResult,
  ToolExecutionContext,
} from "./tool-types";

function canAccessTool(
  tool: AnyOpsFlowTool,
  auth: AuthContext,
  audience: ToolAudience,
) {
  if (!tool.audiences.includes(audience)) {
    return false;
  }

  return !tool.allowedRoles || tool.allowedRoles.includes(auth.role);
}

export class OpsFlowToolRegistry {
  private readonly tools = new Map<string, AnyOpsFlowTool>();

  constructor(
    private readonly options: {
      recordInvocation?: ToolInvocationRecorder;
    } = {},
  ) {}

  register(tool: AnyOpsFlowTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool is already registered: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  list(input: {
    auth: AuthContext;
    audience: ToolAudience;
  }): AnyOpsFlowTool[] {
    return Array.from(this.tools.values()).filter((tool) =>
      canAccessTool(tool, input.auth, input.audience),
    );
  }

  async execute(input: {
    auth: AuthContext;
    audience: ToolAudience;
    toolName: string;
    arguments: unknown;
    context: ToolExecutionContext;
  }): Promise<unknown | ToolErrorResult> {
    const startedAt = Date.now();
    const tool = this.tools.get(input.toolName);

    const finish = async (
      result: unknown | ToolErrorResult,
      parsedInput?: unknown,
      parsedOutput?: unknown,
    ) => {
      if (this.options.recordInvocation) {
        await this.options.recordInvocation(
          buildInvocationAuditEvent({
            auth: input.auth,
            context: input.context,
            toolName: input.toolName,
            startedAt,
            result,
            parsedInput,
            parsedOutput,
          }),
        );
      }

      return result;
    };

    if (!tool) {
      return finish({
        error: true,
        message: `Unknown tool: ${input.toolName}`,
        code: "TOOL_NOT_FOUND",
      });
    }

    if (!canAccessTool(tool, input.auth, input.audience)) {
      return finish({
        error: true,
        message: "Permission denied: your role cannot use this tool.",
        code: "TOOL_PERMISSION_DENIED",
      });
    }

    const parsedInput = tool.inputSchema.safeParse(input.arguments);
    if (!parsedInput.success) {
      return finish(
        formatToolSchemaError(
          "Tool input validation failed.",
          "TOOL_INPUT_VALIDATION_FAILED",
          parsedInput.error,
        ),
      );
    }

    try {
      const result = await tool.execute(input.auth, parsedInput.data, input.context);
      const parsedOutput = tool.outputSchema.safeParse(result);

      if (!parsedOutput.success) {
        return finish(
          formatToolSchemaError(
            "Tool output validation failed.",
            "TOOL_OUTPUT_VALIDATION_FAILED",
            parsedOutput.error,
          ),
          parsedInput.data,
        );
      }

      return finish(parsedOutput.data, parsedInput.data, parsedOutput.data);
    } catch (error) {
      return finish(normalizeToolError(error), parsedInput.data);
    }
  }
}

function objectKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

function toolErrorCode(result: unknown): string | undefined {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    result.error === true &&
    "code" in result &&
    typeof result.code === "string"
  ) {
    return result.code;
  }

  return undefined;
}

function isToolError(result: unknown): result is ToolErrorResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    result.error === true
  );
}

function proposalId(result: unknown): string | undefined {
  if (
    typeof result === "object" &&
    result !== null &&
    "proposalId" in result &&
    typeof result.proposalId === "string"
  ) {
    return result.proposalId;
  }

  return undefined;
}

function buildInvocationAuditEvent(input: {
  auth: AuthContext;
  context: ToolExecutionContext;
  toolName: string;
  startedAt: number;
  result: unknown;
  parsedInput?: unknown;
  parsedOutput?: unknown;
}): ToolInvocationAuditEvent {
  const errorCode = toolErrorCode(input.result);

  return {
    tenantId: input.auth.tenantId,
    userId: input.auth.userId,
    source: input.context.source,
    invocationId: input.context.invocationId,
    requestId: input.context.requestId,
    conversationId: input.context.conversationId,
    toolName: input.toolName,
    status: isToolError(input.result)
      ? ToolInvocationStatus.FAILED
      : ToolInvocationStatus.SUCCEEDED,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    errorCode,
    proposalId: proposalId(input.result),
    inputKeys: objectKeys(input.parsedInput),
    outputKeys: objectKeys(input.parsedOutput),
  };
}
