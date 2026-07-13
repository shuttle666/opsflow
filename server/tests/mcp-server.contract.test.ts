import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { createOpsFlowMcpServer } from "../src/modules/mcp/mcp-server";
import { OpsFlowToolRegistry } from "../src/modules/operations-tools";
import type { AuthContext } from "../src/types/auth";

const auth: AuthContext = {
  userId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  role: MembershipRole.MANAGER,
};

function buildRegistry() {
  const registry = new OpsFlowToolRegistry();
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
    execute: async (_auth, _input, context) => ({
      proposalId: "proposal-1",
      approvalUrl: "http://localhost:3000/agent?conversationId=conversation-1",
      proposal: {
        id: "proposal-1",
        conversationId: context.conversationId ?? "missing",
      },
    }),
  });

  return registry;
}

async function connectTestClient(input?: {
  role?: MembershipRole;
  persistProposalMessage?: ReturnType<typeof vi.fn>;
}) {
  const getConversationId = vi.fn(async () => "conversation-1");
  const persistProposalMessage = input?.persistProposalMessage ?? vi.fn(async () => {});
  const server = createOpsFlowMcpServer({
    auth: { ...auth, role: input?.role ?? auth.role },
    registry: buildRegistry(),
    getConversationId,
    persistProposalMessage,
  });
  const client = new Client({ name: "opsflow-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server, getConversationId, persistProposalMessage };
}

describe("OpsFlow MCP server contract", () => {
  it("exposes role-filtered tools with MCP annotations", async () => {
    const connection = await connectTestClient();

    try {
      const result = await connection.client.listTools();
      expect(result.tools.map((tool) => tool.name)).toEqual([
        "find_example",
        "propose_example",
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
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });

  it("serializes canonical Date values into MCP structured content", async () => {
    const connection = await connectTestClient();

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

  it("does not expose tools to a role excluded by the Registry", async () => {
    const connection = await connectTestClient({ role: MembershipRole.STAFF });

    try {
      await expect(connection.client.listTools()).resolves.toEqual({ tools: [] });
    } finally {
      await connection.client.close();
      await connection.server.close();
    }
  });
});
