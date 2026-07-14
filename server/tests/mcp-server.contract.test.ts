import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  MembershipRole,
  ToolInvocationSource,
  ToolInvocationStatus,
} from "@prisma/client";
import { z } from "zod";
import { createOpsFlowMcpServer } from "../src/modules/mcp/mcp-server";
import { OpsFlowToolRegistry } from "../src/modules/operations-tools";
import type { AuthContext } from "../src/types/auth";
import { ApiError } from "../src/utils/api-error";

const auth: AuthContext = {
  userId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  role: MembershipRole.MANAGER,
};

function buildRegistry(recordInvocation?: ReturnType<typeof vi.fn>) {
  const registry = new OpsFlowToolRegistry({ recordInvocation });
  registry.register({
    name: "find_example",
    title: "Find example",
    description: "Return an example through MCP.",
    audiences: ["external-mcp"],
    allowedRoles: [MembershipRole.MANAGER],
    inputSchema: z.object({ query: z.string().min(1) }).strict(),
    outputSchema: z.object({ id: z.string(), seenAt: z.date() }),
    annotations: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    conversationContext: "none",
    execute: async (_auth, input) => ({
      id: input.query,
      seenAt: new Date("2026-07-14T00:00:00.000Z"),
    }),
  });
  registry.register({
    name: "propose_example",
    title: "Propose example",
    description: "Return an approval-gated proposal through MCP.",
    audiences: ["external-mcp"],
    allowedRoles: [MembershipRole.MANAGER],
    inputSchema: z.object({ title: z.string().min(1) }).strict(),
    outputSchema: z.object({
      proposalId: z.string(),
      approvalUrl: z.string(),
      proposal: z.object({
        id: z.string(),
        conversationId: z.string(),
      }),
    }),
    annotations: {
      readOnly: false,
      destructive: false,
      idempotent: false,
      openWorld: false,
    },
    conversationContext: "required",
    execute: async (_auth, _input, context) => ({
      proposalId: "proposal-1",
      approvalUrl: "http://localhost:3000/agent?conversationId=conversation-1",
      proposal: {
        id: "proposal-1",
        conversationId: context.conversationId ?? "missing",
      },
    }),
  });
  registry.register({
    name: "get_proposal",
    title: "Get proposal",
    description: "Read a proposal without creating a conversation.",
    audiences: ["external-mcp"],
    allowedRoles: [MembershipRole.MANAGER],
    inputSchema: z.object({ proposalId: z.string() }).strict(),
    outputSchema: z.object({
      proposalId: z.string(),
      conversationId: z.string(),
      status: z.literal("PENDING"),
    }),
    annotations: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    conversationContext: "none",
    execute: async (_auth, input) => ({
      proposalId: input.proposalId,
      conversationId: "conversation-original",
      status: "PENDING" as const,
    }),
  });
  registry.register({
    name: "execute_proposal",
    title: "Execute proposal",
    description: "Execute only after a later explicit user confirmation.",
    audiences: ["external-mcp"],
    allowedRoles: [MembershipRole.MANAGER],
    inputSchema: z
      .object({ proposalId: z.string(), confirmationText: z.string() })
      .strict(),
    outputSchema: z.object({
      executed: z.literal(true),
      proposalId: z.string(),
      conversationId: z.string(),
      status: z.literal("CONFIRMED"),
      result: z.object({ proposalId: z.string() }),
    }),
    annotations: {
      readOnly: false,
      destructive: true,
      idempotent: true,
      openWorld: false,
    },
    conversationContext: "none",
    execute: async (_auth, input) => {
      if (input.proposalId === "web-only") {
        throw new ApiError(409, "Use Web approval.", {
          code: "PROPOSAL_WEB_APPROVAL_REQUIRED",
          approvalUrl: "http://localhost:3000/agent?proposalId=web-only",
        });
      }

      return {
        executed: true as const,
        proposalId: input.proposalId,
        conversationId: "conversation-original",
        status: "CONFIRMED" as const,
        result: { proposalId: input.proposalId },
      };
    },
  });

  return registry;
}

async function connectTestClient(input?: {
  role?: MembershipRole;
  persistProposalMessage?: ReturnType<typeof vi.fn>;
  persistProposalExecutionMessage?: ReturnType<typeof vi.fn>;
  recordInvocation?: ReturnType<typeof vi.fn>;
  resolveAuth?: ReturnType<typeof vi.fn>;
}) {
  const getConversationId = vi.fn(async () => "conversation-1");
  const persistProposalMessage = input?.persistProposalMessage ?? vi.fn(async () => {});
  const persistProposalExecutionMessage =
    input?.persistProposalExecutionMessage ?? vi.fn(async () => {});
  const server = createOpsFlowMcpServer({
    auth: { ...auth, role: input?.role ?? auth.role },
    resolveAuth: input?.resolveAuth,
    registry: buildRegistry(input?.recordInvocation),
    getConversationId,
    persistProposalMessage,
    persistProposalExecutionMessage,
  });
  const client = new Client({ name: "opsflow-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    server,
    getConversationId,
    persistProposalMessage,
    persistProposalExecutionMessage,
  };
}

describe("OpsFlow MCP server contract", () => {
  it("exposes role-filtered tools with MCP annotations", async () => {
    const connection = await connectTestClient();

    try {
      const result = await connection.client.listTools();
      expect(result.tools.map((tool) => tool.name)).toEqual([
        "find_example",
        "propose_example",
        "get_proposal",
        "execute_proposal",
      ]);
      expect(result.tools[0]).toEqual(
        expect.objectContaining({
          title: "Find example",
          annotations: expect.objectContaining({
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: false,
          }),
        }),
      );
      expect(result.tools[0]?.inputSchema).toEqual(
        expect.objectContaining({
          type: "object",
          required: ["query"],
        }),
      );
      expect(result.tools[3]).toEqual(
        expect.objectContaining({
          annotations: expect.objectContaining({
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
          }),
        }),
      );
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("serializes canonical Date values into MCP structured content", async () => {
    const recordInvocation = vi.fn(async () => {});
    const connection = await connectTestClient({ recordInvocation });

    try {
      const result = await connection.client.callTool({
        name: "find_example",
        arguments: { query: "job-1" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({
        id: "job-1",
        seenAt: "2026-07-14T00:00:00.000Z",
      });
      expect(connection.getConversationId).not.toHaveBeenCalled();
      expect(recordInvocation).toHaveBeenCalledWith(
        expect.objectContaining({
          source: ToolInvocationSource.MCP,
          toolName: "find_example",
          status: ToolInvocationStatus.SUCCEEDED,
          requestId: expect.any(String),
          inputKeys: ["query"],
          outputKeys: ["id", "seenAt"],
        }),
      );
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("creates a Web-visible conversation link for proposal tools", async () => {
    const persistProposalMessage = vi.fn(async () => {});
    const connection = await connectTestClient({ persistProposalMessage });

    try {
      const result = await connection.client.callTool({
        name: "propose_example",
        arguments: { title: "Repair" },
      });

      expect(result.structuredContent).toEqual(
        expect.objectContaining({
          proposalId: "proposal-1",
          proposal: {
            id: "proposal-1",
            conversationId: "conversation-1",
          },
        }),
      );
      expect(connection.getConversationId).toHaveBeenCalledOnce();
      expect(persistProposalMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          auth,
          conversationId: "conversation-1",
          toolName: "propose_example",
          proposalId: "proposal-1",
        }),
      );
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("executes against the proposal conversation without creating a new one", async () => {
    const recordInvocation = vi.fn(async () => {});
    const persistProposalExecutionMessage = vi.fn(async () => {});
    const connection = await connectTestClient({
      recordInvocation,
      persistProposalExecutionMessage,
    });

    try {
      const result = await connection.client.callTool({
        name: "execute_proposal",
        arguments: {
          proposalId: "proposal-1",
          confirmationText: "OK, execute it",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual(
        expect.objectContaining({
          executed: true,
          proposalId: "proposal-1",
          conversationId: "conversation-original",
        }),
      );
      expect(connection.getConversationId).not.toHaveBeenCalled();
      expect(persistProposalExecutionMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          auth,
          conversationId: "conversation-original",
          toolName: "execute_proposal",
          proposalId: "proposal-1",
        }),
      );
      expect(recordInvocation).toHaveBeenCalledWith(
        expect.objectContaining({
          source: ToolInvocationSource.MCP,
          conversationId: "conversation-original",
          toolName: "execute_proposal",
          proposalId: "proposal-1",
          inputKeys: ["confirmationText", "proposalId"],
          status: ToolInvocationStatus.SUCCEEDED,
        }),
      );
      expect(JSON.stringify(recordInvocation.mock.calls)).not.toContain(
        "OK, execute it",
      );
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("preserves structured proposal errors and Web fallback details", async () => {
    const connection = await connectTestClient();

    try {
      const result = await connection.client.callTool({
        name: "execute_proposal",
        arguments: { proposalId: "web-only", confirmationText: "OK" },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        error: true,
        message: "Use Web approval.",
        code: "PROPOSAL_WEB_APPROVAL_REQUIRED",
        details: {
          code: "PROPOSAL_WEB_APPROVAL_REQUIRED",
          approvalUrl: "http://localhost:3000/agent?proposalId=web-only",
        },
      });
      expect(connection.getConversationId).not.toHaveBeenCalled();
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("does not expose tools to a role excluded by the Registry", async () => {
    const connection = await connectTestClient({ role: MembershipRole.STAFF });

    try {
      await expect(connection.client.listTools()).resolves.toEqual({ tools: [] });
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("revalidates authentication before every MCP tool call", async () => {
    const resolveAuth = vi.fn(async () => auth);
    const connection = await connectTestClient({ resolveAuth });

    try {
      await connection.client.callTool({
        name: "find_example",
        arguments: { query: "job-1" },
      });
      await connection.client.callTool({
        name: "find_example",
        arguments: { query: "job-2" },
      });

      expect(resolveAuth).toHaveBeenCalledTimes(2);
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });
});
