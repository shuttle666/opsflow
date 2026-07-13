import type { AuthContext } from "../../types/auth";
import {
  formatToolSchemaError,
  normalizeToolError,
} from "./tool-errors";
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
    const tool = this.tools.get(input.toolName);

    if (!tool) {
      return {
        error: true,
        message: `Unknown tool: ${input.toolName}`,
        code: "TOOL_NOT_FOUND",
      };
    }

    if (!canAccessTool(tool, input.auth, input.audience)) {
      return {
        error: true,
        message: "Permission denied: your role cannot use this tool.",
        code: "TOOL_PERMISSION_DENIED",
      };
    }

    const parsedInput = tool.inputSchema.safeParse(input.arguments);
    if (!parsedInput.success) {
      return formatToolSchemaError(
        "Tool input validation failed.",
        "TOOL_INPUT_VALIDATION_FAILED",
        parsedInput.error,
      );
    }

    try {
      const result = await tool.execute(input.auth, parsedInput.data, input.context);
      const parsedOutput = tool.outputSchema.safeParse(result);

      if (!parsedOutput.success) {
        return formatToolSchemaError(
          "Tool output validation failed.",
          "TOOL_OUTPUT_VALIDATION_FAILED",
          parsedOutput.error,
        );
      }

      return parsedOutput.data;
    } catch (error) {
      return normalizeToolError(error);
    }
  }
}
