import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "../../types/auth";
import {
  appendExternalProposalExecutionMessage,
  appendExternalProposalMessage,
} from "../agent/agent.service";
import {
  opsFlowToolRegistry,
  type AnyOpsFlowTool,
  type OpsFlowToolRegistry,
  type ToolErrorResult,
} from "../operations-tools";

type ProposalResult = {
  proposalId: string;
  proposal: {
    id: string;
    conversationId: string;
  };
};

type ProposalExecutionResult = {
  executed: true;
  proposalId: string;
  conversationId: string;
};

type ProposalPersistenceInput = {
  auth: AuthContext;
  conversationId: string;
  toolName: string;
  toolInput: unknown;
  toolResult: Record<string, unknown>;
  proposalId: string;
};

export type CreateOpsFlowMcpServerOptions = {
  auth: AuthContext;
  resolveAuth?: () => Promise<AuthContext>;
  registry?: OpsFlowToolRegistry;
  getConversationId: () => Promise<string>;
  persistProposalMessage?: (input: ProposalPersistenceInput) => Promise<void>;
  persistProposalExecutionMessage?: (
    input: ProposalPersistenceInput,
  ) => Promise<void>;
};

function isToolError(result: unknown): result is ToolErrorResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    result.error === true
  );
}

function isProposalResult(result: unknown): result is ProposalResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const candidate = result as Partial<ProposalResult>;
  return (
    typeof candidate.proposalId === "string" &&
    typeof candidate.proposal === "object" &&
    candidate.proposal !== null &&
    typeof candidate.proposal.id === "string" &&
    typeof candidate.proposal.conversationId === "string"
  );
}

function isProposalExecutionResult(
  result: unknown,
): result is ProposalExecutionResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const candidate = result as Partial<ProposalExecutionResult>;
  return (
    candidate.executed === true &&
    typeof candidate.proposalId === "string" &&
    typeof candidate.conversationId === "string"
  );
}

function toStructuredContent(result: unknown): Record<string, unknown> {
  const serialized = JSON.parse(JSON.stringify(result)) as unknown;
  if (typeof serialized === "object" && serialized !== null && !Array.isArray(serialized)) {
    return serialized as Record<string, unknown>;
  }

  return { result: serialized };
}

async function defaultPersistProposalMessage(input: ProposalPersistenceInput) {
  await appendExternalProposalMessage(input.auth, {
    conversationId: input.conversationId,
    toolName: input.toolName,
    toolInput: input.toolInput,
    toolResult: input.toolResult,
    proposalId: input.proposalId,
  });
}

async function defaultPersistProposalExecutionMessage(
  input: ProposalPersistenceInput,
) {
  await appendExternalProposalExecutionMessage(input.auth, {
    conversationId: input.conversationId,
    toolName: input.toolName,
    toolInput: input.toolInput,
    toolResult: input.toolResult,
    proposalId: input.proposalId,
  });
}

function listAllExternalMcpTools(
  registry: OpsFlowToolRegistry,
  auth: AuthContext,
): AnyOpsFlowTool[] {
  const toolsByName = new Map<string, AnyOpsFlowTool>();

  for (const role of Object.values(MembershipRole)) {
    for (const tool of registry.list({
      auth: { ...auth, role },
      audience: "external-mcp",
    })) {
      toolsByName.set(tool.name, tool);
    }
  }

  return Array.from(toolsByName.values());
}

function toMcpToolDefinition(tool: AnyOpsFlowTool) {
  const inputSchema = z.toJSONSchema(tool.inputSchema, {
    target: "draft-07",
  });

  if (inputSchema.type !== "object") {
    throw new Error(`Tool input schema must be an object: ${tool.name}`);
  }

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: inputSchema as { type: "object"; [key: string]: unknown },
    annotations: {
      title: tool.title,
      readOnlyHint: tool.annotations.readOnly,
      destructiveHint: tool.annotations.destructive,
      idempotentHint: tool.annotations.idempotent,
      openWorldHint: tool.annotations.openWorld,
    },
  };
}

export function createOpsFlowMcpServer(
  options: CreateOpsFlowMcpServerOptions,
): McpServer {
  const registry = options.registry ?? opsFlowToolRegistry;
  const persistProposalMessage =
    options.persistProposalMessage ?? defaultPersistProposalMessage;
  const persistProposalExecutionMessage =
    options.persistProposalExecutionMessage ??
    defaultPersistProposalExecutionMessage;
  const tools = listAllExternalMcpTools(registry, options.auth);
  const server = new McpServer({
    name: "opsflow-local",
    version: "1.0.0",
  });

  if (tools.length === 0) {
    server.server.registerCapabilities({ tools: {} });
  }

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.annotations.readOnly,
          destructiveHint: tool.annotations.destructive,
          idempotentHint: tool.annotations.idempotent,
          openWorldHint: tool.annotations.openWorld,
        },
      },
      async (toolInput, extra) => {
        const currentAuth = options.resolveAuth
          ? await options.resolveAuth()
          : options.auth;
        const remainsAccessible = registry
          .list({
            auth: currentAuth,
            audience: "external-mcp",
          })
          .some((candidate) => candidate.name === tool.name);
        const conversationId =
          remainsAccessible && tool.conversationContext === "required"
            ? await options.getConversationId()
            : undefined;
        const result = await registry.execute({
          auth: currentAuth,
          audience: "external-mcp",
          toolName: tool.name,
          arguments: toolInput,
          context: {
            source: "MCP",
            invocationId: randomUUID(),
            requestId: String(extra.requestId),
            conversationId,
            mcpSessionId: extra.sessionId,
          },
        });

        if (isToolError(result)) {
          const structuredContent = toStructuredContent(result);
          return {
            isError: true,
            content: [
              { type: "text" as const, text: JSON.stringify(structuredContent) },
            ],
            structuredContent,
          };
        }

        const structuredContent = toStructuredContent(result);
        if (conversationId && isProposalResult(result)) {
          await persistProposalMessage({
            auth: currentAuth,
            conversationId,
            toolName: tool.name,
            toolInput,
            toolResult: structuredContent,
            proposalId: result.proposalId,
          });
        }
        if (isProposalExecutionResult(result)) {
          await persistProposalExecutionMessage({
            auth: currentAuth,
            conversationId: result.conversationId,
            toolName: tool.name,
            toolInput,
            toolResult: structuredContent,
            proposalId: result.proposalId,
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structuredContent),
            },
          ],
          structuredContent,
        };
      },
    );
  }

  // The SDK's default list handler reflects the tools registered when the
  // connection was created. Replace it with a live, tenant-aware view so a
  // role or membership change is visible without reconnecting. Execution is
  // still independently revalidated in each registered tool callback.
  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    const currentAuth = options.resolveAuth
      ? await options.resolveAuth()
      : options.auth;

    return {
      tools: registry
        .list({ auth: currentAuth, audience: "external-mcp" })
        .map(toMcpToolDefinition),
    };
  });

  return server;
}
