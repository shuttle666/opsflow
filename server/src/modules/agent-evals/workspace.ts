import {
  JobStatus,
  MembershipRole,
  MembershipStatus,
  type Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";

export const AI_EVAL_TENANT_SLUG_PREFIX = "ai-eval-";

type EvalUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AgentEvalWorkspace = {
  tenant: {
    id: string;
    slug: string;
  };
  owner: EvalUser;
  auth: AuthContext;
  createStaff: (input: {
    displayName: string;
    email?: string;
  }) => Promise<{
    user: EvalUser;
    membership: {
      id: string;
      userId: string;
    };
  }>;
  createCustomer: (input: {
    name: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  }) => Promise<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  }>;
  createJob: (input: {
    customerId: string;
    title: string;
    serviceAddress: string;
    description?: string | null;
    status?: JobStatus;
    assignedToId?: string | null;
    scheduledStartAt?: Date | null;
    scheduledEndAt?: Date | null;
  }) => Promise<{
    id: string;
    title: string;
    serviceAddress: string;
  }>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 40);
}

async function deleteTenantScopedData(tenantId: string) {
  const conversations = await prisma.agentConversation.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const conversationIds = conversations.map((conversation) => conversation.id);

  if (conversationIds.length > 0) {
    await prisma.agentToolCall.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.agentProposal.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.agentMessage.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.agentConversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }

  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.tenantInvitation.deleteMany({ where: { tenantId } });
  await prisma.authSession.deleteMany({ where: { tenantId } });

  const jobs = await prisma.job.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);

  if (jobIds.length > 0) {
    await prisma.jobEvidence.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.jobCompletionReview.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.jobStatusHistory.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  }

  await prisma.customer.deleteMany({ where: { tenantId } });

  const memberships = await prisma.membership.findMany({
    where: { tenantId },
    select: { userId: true },
  });
  const userIds = memberships.map((membership) => membership.userId);

  await prisma.membership.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

export async function cleanupEvalTenants() {
  const tenants = await prisma.tenant.findMany({
    where: {
      slug: {
        startsWith: AI_EVAL_TENANT_SLUG_PREFIX,
      },
    },
    select: { id: true },
  });

  for (const tenant of tenants) {
    await deleteTenantScopedData(tenant.id);
  }
}

export async function cleanupEvalWorkspace(workspace: AgentEvalWorkspace) {
  await deleteTenantScopedData(workspace.tenant.id);
}

export async function createEvalWorkspace(caseName: string): Promise<AgentEvalWorkspace> {
  const id = randomUUID();
  const slug = `${AI_EVAL_TENANT_SLUG_PREFIX}${slugify(caseName)}-${id.slice(0, 8)}`;
  const ownerEmail = `owner-${id}@eval.opsflow.test`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `AI Eval ${caseName}`,
      slug,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      passwordHash: "ai-eval-password-hash-not-used",
      displayName: "Eval Owner",
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  const auth: AuthContext = {
    userId: owner.id,
    sessionId: `ai-eval-${id}`,
    tenantId: tenant.id,
    role: MembershipRole.OWNER,
  };

  return {
    tenant,
    owner,
    auth,
    createStaff: async (input) => {
      const staffId = randomUUID();
      const user = await prisma.user.create({
        data: {
          email: input.email ?? `staff-${staffId}@eval.opsflow.test`,
          passwordHash: "ai-eval-password-hash-not-used",
          displayName: input.displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      });
      const membership = await prisma.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      return { user, membership };
    },
    createCustomer: async (input) =>
      prisma.customer.create({
        data: {
          tenantId: tenant.id,
          createdById: owner.id,
          name: input.name,
          phone: input.phone,
          email: input.email,
          notes: input.notes,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      }),
    createJob: async (input) =>
      prisma.job.create({
        data: {
          tenantId: tenant.id,
          customerId: input.customerId,
          createdById: owner.id,
          title: input.title,
          serviceAddress: input.serviceAddress,
          description: input.description,
          status: input.status ?? JobStatus.NEW,
          assignedToId: input.assignedToId,
          scheduledAt: input.scheduledStartAt,
          scheduledStartAt: input.scheduledStartAt,
          scheduledEndAt: input.scheduledEndAt,
        } satisfies Prisma.JobUncheckedCreateInput,
        select: {
          id: true,
          title: true,
          serviceAddress: true,
        },
      }),
  };
}
