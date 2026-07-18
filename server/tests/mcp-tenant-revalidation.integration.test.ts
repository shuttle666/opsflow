import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { createOpsFlowMcpServer } from "../src/modules/mcp/mcp-server";
import { resolveMcpAuthContextFromAccessToken } from "../src/modules/mcp/stdio";
import { OpsFlowToolRegistry } from "../src/modules/operations-tools";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("MCP tenant access revalidation", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("applies current role, membership, and tenant state to every tool call", async () => {
    const password = "password123";
    const passwordHash = await hashPassword(password);
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "MCP Revalidation Tenant",
          slug: "mcp-revalidation-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "owner@mcp-revalidation.test",
          passwordHash,
          displayName: "MCP Revalidation Owner",
        },
      }),
    ]);
    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const session = await login({
      email: user.email,
      password,
      tenantId: tenant.id,
    });

    const executeOwnerTool = vi.fn(async () => ({ accepted: true }));
    const registry = new OpsFlowToolRegistry();
    registry.register({
      name: "owner_only_operation",
      title: "Owner-only operation",
      description: "A registered MCP tool that must honor current tenant access.",
      audiences: ["external-mcp"],
      allowedRoles: [MembershipRole.OWNER],
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ accepted: z.boolean() }),
      annotations: {
        readOnly: false,
        destructive: true,
        idempotent: true,
        openWorld: false,
      },
      conversationContext: "required",
      execute: executeOwnerTool,
    });

    const resolveAuth = () =>
      resolveMcpAuthContextFromAccessToken(session.accessToken);
    const initialAuth = await resolveAuth();
    const getConversationId = vi.fn(async () => "unused-conversation");
    const server = createOpsFlowMcpServer({
      auth: initialAuth,
      resolveAuth,
      registry,
      getConversationId,
    });
    const client = new Client({
      name: "mcp-revalidation-integration-test",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      await expect(client.listTools()).resolves.toMatchObject({
        tools: [expect.objectContaining({ name: "owner_only_operation" })],
      });

      const initialCall = await client.callTool({
        name: "owner_only_operation",
        arguments: {},
      });
      expect(initialCall.isError).not.toBe(true);
      expect(initialCall.structuredContent).toEqual({ accepted: true });
      expect(executeOwnerTool).toHaveBeenCalledTimes(1);
      expect(getConversationId).toHaveBeenCalledTimes(1);

      await prisma.membership.update({
        where: {
          userId_tenantId: {
            tenantId: tenant.id,
            userId: user.id,
          },
        },
        data: { role: MembershipRole.STAFF },
      });

      await expect(client.listTools()).resolves.toEqual({ tools: [] });

      const demotedCall = await client.callTool({
        name: "owner_only_operation",
        arguments: {},
      });
      expect(demotedCall).toMatchObject({
        isError: true,
        structuredContent: {
          error: true,
          code: "TOOL_PERMISSION_DENIED",
        },
      });
      expect(executeOwnerTool).toHaveBeenCalledTimes(1);
      expect(getConversationId).toHaveBeenCalledTimes(1);

      await prisma.membership.update({
        where: {
          userId_tenantId: {
            tenantId: tenant.id,
            userId: user.id,
          },
        },
        data: {
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      await expect(client.listTools()).resolves.toMatchObject({
        tools: [expect.objectContaining({ name: "owner_only_operation" })],
      });

      await prisma.membership.update({
        where: {
          userId_tenantId: {
            tenantId: tenant.id,
            userId: user.id,
          },
        },
        data: {
          status: MembershipStatus.DISABLED,
        },
      });

      await expect(client.listTools()).rejects.toThrow(
        "Membership is not active for this tenant.",
      );

      const disabledMembershipCall = await client.callTool({
        name: "owner_only_operation",
        arguments: {},
      });
      expect(disabledMembershipCall.isError).toBe(true);
      expect(disabledMembershipCall.content).toEqual([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining(
            "Membership is not active for this tenant.",
          ),
        }),
      ]);
      expect(executeOwnerTool).toHaveBeenCalledTimes(1);
      expect(getConversationId).toHaveBeenCalledTimes(1);

      await prisma.membership.update({
        where: {
          userId_tenantId: {
            tenantId: tenant.id,
            userId: user.id,
          },
        },
        data: { status: MembershipStatus.ACTIVE },
      });
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.DEACTIVATED },
      });

      await expect(client.listTools()).rejects.toThrow("Tenant is inactive.");

      const deactivatedTenantCall = await client.callTool({
        name: "owner_only_operation",
        arguments: {},
      });
      expect(deactivatedTenantCall.isError).toBe(true);
      expect(deactivatedTenantCall.content).toEqual([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("Tenant is inactive."),
        }),
      ]);
      expect(executeOwnerTool).toHaveBeenCalledTimes(1);
      expect(getConversationId).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
