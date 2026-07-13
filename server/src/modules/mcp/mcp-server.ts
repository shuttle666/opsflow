import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { AuthContext } from "../../types/auth";
import { appendExternalProposalMessage } from "../agent/agent.service";
import {
  opsFlowToolRegistry,
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
  registry?: OpsFlowToolRegistry;
  getConversationId: () => Promise<string>;
  persistProposalMessage?: (input: ProposalPersistenceInput) => Promise<void>;
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

export function createOpsFlowMcpServer(
  options: CreateOpsFlowMcpServerOptions,
): McpServer {
  const registry = options.registry ?? opsFlowToolRegistry;
  const persistProposalMessage =
    options.persistProposalMessage ?? defaultPersistProposalMessage;
  const tools = registry.list({
    auth: options.auth,
    audience: "external-mcp",
  });
  const server = new McpServer({
    name: "opsflow-local",
    version: "1.0.0",
  });

  if (tools.length === 0) {
    server.server.registerCapabilities({ tools: {} });
    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
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
        const conversationId = tool.annotations.readOnly
          ? undefined
          : await options.getConversationId();
        const result = await registry.execute({
          auth: options.auth,
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
          return {
            isError: true,
            content: [{ type: "text" as const, text: result.message }],
          };
        }

        const structuredContent = toStructuredContent(result);
        if (conversationId && isProposalResult(result)) {
          await persistProposalMessage({
            auth: options.auth,
            conversationId,
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

  return server;
}
