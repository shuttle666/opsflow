import {
  MembershipRole,
  ToolInvocationSource,
  ToolInvocationStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import {
  OpsFlowToolRegistry,
  recordToolInvocationSafe,
} from "../src/modules/operations-tools";
import type { AuthContext } from "../src/types/auth";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("tool invocation audit integration", () => {
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

  async function seedActor(input: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    displayName: string;
  }): Promise<AuthContext> {
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      }),
      prisma.user.create({
        data: {
          email: input.email,
          passwordHash: "not-used-by-tool-audit-test",
          displayName: input.displayName,
        },
      }),
    ]);

    return {
      tenantId: tenant.id,
      userId: user.id,
      sessionId: `audit-test-session-${user.id}`,
      role: MembershipRole.OWNER,
    };
  }

  function buildRegistry() {
    const registry = new OpsFlowToolRegistry({
      recordInvocation: recordToolInvocationSafe,
    });

    registry.register({
      name: "audit_probe",
      title: "Audit probe",
      description: "Exercises persisted invocation metadata without storing values.",
      audiences: ["web-agent"],
      allowedRoles: [MembershipRole.OWNER],
      inputSchema: z
        .object({
          customerEmail: z.string().email(),
          serviceAddress: z.string().min(1),
        })
        .strict(),
      outputSchema: z.object({
        accepted: z.boolean(),
        echoedAddress: z.string(),
      }),
      annotations: {
        readOnly: true,
        destructive: false,
        idempotent: true,
        openWorld: false,
      },
      conversationContext: "none",
      execute: async (_auth, input) => ({
        accepted: true,
        echoedAddress: input.serviceAddress,
      }),
    });

    return registry;
  }

  it("scopes replay identity by actor and persists only structural metadata", async () => {
    const [actorA, actorB] = await Promise.all([
      seedActor({
        tenantName: "Audit Tenant A",
        tenantSlug: "audit-tenant-a",
        email: "owner-a@tool-audit.test",
        displayName: "Audit Owner A",
      }),
      seedActor({
        tenantName: "Audit Tenant B",
        tenantSlug: "audit-tenant-b",
        email: "owner-b@tool-audit.test",
        displayName: "Audit Owner B",
      }),
    ]);
    const registry = buildRegistry();
    const invocationId = "shared-invocation-id";
    const sensitiveValues = [
      "private-a@example.com",
      "18 Secret Street, Adelaide SA 5000",
      "private-b@example.com",
      "42 Hidden Road, Melbourne VIC 3000",
    ];

    await registry.execute({
      auth: actorA,
      audience: "web-agent",
      toolName: "audit_probe",
      arguments: {
        customerEmail: sensitiveValues[0],
        serviceAddress: sensitiveValues[1],
      },
      context: {
        source: "WEB_AGENT",
        invocationId,
        requestId: "request-actor-a-first",
      },
    });
    await registry.execute({
      auth: actorB,
      audience: "web-agent",
      toolName: "audit_probe",
      arguments: {
        customerEmail: sensitiveValues[2],
        serviceAddress: sensitiveValues[3],
      },
      context: {
        source: "WEB_AGENT",
        invocationId,
        requestId: "request-actor-b",
      },
    });

    const actorAFirst = await prisma.toolInvocation.findFirstOrThrow({
      where: {
        tenantId: actorA.tenantId,
        userId: actorA.userId,
        source: ToolInvocationSource.WEB_AGENT,
        invocationId,
      },
    });
    const actorBBeforeReplay = await prisma.toolInvocation.findFirstOrThrow({
      where: {
        tenantId: actorB.tenantId,
        userId: actorB.userId,
        source: ToolInvocationSource.WEB_AGENT,
        invocationId,
      },
    });

    await registry.execute({
      auth: actorA,
      audience: "web-agent",
      toolName: "audit_probe",
      arguments: {
        customerEmail: sensitiveValues[0],
        serviceAddress: sensitiveValues[1],
      },
      context: {
        source: "WEB_AGENT",
        invocationId,
        requestId: "request-actor-a-replay",
      },
    });

    const records = await prisma.toolInvocation.findMany({
      where: {
        source: ToolInvocationSource.WEB_AGENT,
        invocationId,
      },
    });
    const actorAAfterReplay = records.find(
      (record) =>
        record.tenantId === actorA.tenantId && record.userId === actorA.userId,
    );
    const actorBAfterReplay = records.find(
      (record) =>
        record.tenantId === actorB.tenantId && record.userId === actorB.userId,
    );

    expect(records).toHaveLength(2);
    expect(actorAAfterReplay).toMatchObject({
      id: actorAFirst.id,
      tenantId: actorA.tenantId,
      userId: actorA.userId,
      requestId: "request-actor-a-replay",
      toolName: "audit_probe",
      status: ToolInvocationStatus.SUCCEEDED,
      inputKeys: ["customerEmail", "serviceAddress"],
      outputKeys: ["accepted", "echoedAddress"],
    });
    expect(actorBAfterReplay).toEqual(actorBBeforeReplay);
    expect(actorBAfterReplay).toMatchObject({
      requestId: "request-actor-b",
      tenantId: actorB.tenantId,
      userId: actorB.userId,
    });

    const persistedAudit = JSON.stringify(records);
    for (const value of sensitiveValues) {
      expect(persistedAudit).not.toContain(value);
    }
  });
});
