import type { MembershipRole } from "@prisma/client";
import type { z } from "zod";
import type { AuthContext } from "../../types/auth";

export type ToolAudience = "web-agent" | "external-mcp";

export type ToolSource = "WEB_AGENT" | "MCP";

export type ToolExecutionContext = {
  source: ToolSource;
  invocationId: string;
  requestId?: string;
  conversationId?: string;
  mcpSessionId?: string;
};

export type ToolAnnotations = {
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
  openWorld: boolean;
};

export type ToolConversationContext = "required" | "none";

export type OpsFlowTool<TInput = unknown, TOutput = unknown> = {
  name: string;
  title: string;
  description: string;
  audiences: ToolAudience[];
  allowedRoles?: MembershipRole[];
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  annotations: ToolAnnotations;
  conversationContext: ToolConversationContext;
  execute: (
    auth: AuthContext,
    input: TInput,
    context: ToolExecutionContext,
  ) => Promise<TOutput>;
};

export type AnyOpsFlowTool = OpsFlowTool<any, any>;

export type ToolErrorResult = {
  error: true;
  message: string;
  code?: string;
  details?: unknown;
};
