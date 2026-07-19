import {
  AuditAction,
  DemoWorkspaceStatus,
  JobStatus,
  MembershipRole,
  MembershipStatus,
  Prisma,
  TenantStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { localWallTimeToUtcIso } from "../agent/agent-time";
import { closeAgentStreamsForTenant } from "../agent/agent-stream-registry";
import { hashPassword } from "../auth/auth-password";
import { AuthError } from "../auth/auth-errors";
import {
  createSessionAndTokens,
  type AuthResult,
} from "../auth/auth.service";
import { evidenceStorage } from "../evidence/evidence-storage";
import { closeNotificationStreamsForTenant } from "../notification/notification-broker";
import type {
  DemoWorkspaceAuthMetadata,
  GoldenDemoScenario,
} from "./demo-workspace.types";

export const GOLDEN_DEMO_TEMPLATE_VERSION = "golden-demo.v1";
export const GOLDEN_DEMO_TIMEZONE = "Australia/Melbourne";
export const GOLDEN_DEMO_CUSTOMER_NAME = "Aiden Murphy";
export const GOLDEN_DEMO_STAFF_NAME = "Sofia Nguyen";

const DEMO_WORKSPACE_SLUG_PREFIX = "private-demo-";
const DEMO_WORKSPACE_CREATION_LOCK_KEY = 1_730_131_751;
const CLEANUP_LEASE_MS = 10 * 60 * 1000;

export type PrivateDemoAuthResult = AuthResult & {
  demoWorkspace: DemoWorkspaceAuthMetadata;
};

type CleanupOptions = {
  now?: Date;
  limit?: number;
};

export type DemoWorkspaceCleanupResult = {
  claimed: number;
  deleted: number;
  failed: number;
};

function formatDateInTimezone(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekdayInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
}

export function resolveNextGoldenDemoBusinessDate(now = new Date()) {
  for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
    const candidate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const weekday = weekdayInTimezone(candidate, GOLDEN_DEMO_TIMEZONE);

    if (weekday !== "Sat" && weekday !== "Sun") {
      return formatDateInTimezone(candidate, GOLDEN_DEMO_TIMEZONE);
    }
  }

  throw new Error("Unable to resolve the next Golden Demo business date.");
}

function buildGoldenDemoScenario(now: Date): GoldenDemoScenario {
  const localDate = resolveNextGoldenDemoBusinessDate(now);
  const localStartTime = "14:00";
  const localEndTime = "15:00";
  const serviceAddress = "18 Collins Street, Melbourne VIC 3000";

  return {
    customerName: GOLDEN_DEMO_CUSTOMER_NAME,
    staffName: GOLDEN_DEMO_STAFF_NAME,
    timezone: GOLDEN_DEMO_TIMEZONE,
    localDate,
    localStartTime,
    localEndTime,
    serviceAddress,
    suggestedPrompt:
      `Create an air conditioner service job for ${GOLDEN_DEMO_CUSTOMER_NAME}, ` +
      `at ${serviceAddress}, assign it to ${GOLDEN_DEMO_STAFF_NAME}, and schedule it on ${localDate} ` +
      `from ${localStartTime} to ${localEndTime} in ${GOLDEN_DEMO_TIMEZONE}.`,
  };
}

function assertDemoCreationEnabled() {
  if (!env.DEMO_WORKSPACE_ENABLED) {
    throw new ApiError(
      503,
      "Quick demo workspaces are currently unavailable.",
      "DEMO_WORKSPACE_DISABLED",
    );
  }
}

function demoWorkspaceExpiry(now: Date) {
  return new Date(now.getTime() + env.DEMO_WORKSPACE_TTL_MINUTES * 60 * 1000);
}

async function lockDemoWorkspaceCreation(tx: Prisma.TransactionClient) {
  await tx.$queryRaw<Array<{ locked: number }>>`
    SELECT 1::int AS "locked"
    FROM (
      SELECT pg_advisory_xact_lock(${DEMO_WORKSPACE_CREATION_LOCK_KEY})
    ) AS acquired
  `;
}

async function assertDemoWorkspaceCapacity(
  tx: Prisma.TransactionClient,
  now: Date,
) {
  const activeCount = await tx.demoWorkspace.count({
    where: {
      status: DemoWorkspaceStatus.ACTIVE,
      expiresAt: { gt: now },
    },
  });
  const totalCount = await tx.demoWorkspace.count();

  const hardTotalLimit = env.DEMO_WORKSPACE_MAX_ACTIVE * 2;
  if (
    activeCount >= env.DEMO_WORKSPACE_MAX_ACTIVE ||
    totalCount >= hardTotalLimit
  ) {
    throw new ApiError(
      503,
      "The quick demo is at capacity. Please try again later.",
      "DEMO_WORKSPACE_CAPACITY_REACHED",
    );
  }
}

export async function createPrivateDemoSession(
  metadata?: RequestMetadata,
): Promise<PrivateDemoAuthResult> {
  assertDemoCreationEnabled();

  const now = new Date();
  const expiresAt = demoWorkspaceExpiry(now);
  const scenario = buildGoldenDemoScenario(now);
  const workspaceId = randomUUID();
  const tenantId = randomUUID();
  const ownerId = randomUUID();
  const sofiaId = randomUUID();
  const liamId = randomUUID();
  const aidenId = randomUUID();
  const oliviaId = randomUUID();
  const noahId = randomUUID();
  const scheduledJobId = randomUUID();
  const unscheduledJobId = randomUUID();
  const tenantSlug = `${DEMO_WORKSPACE_SLUG_PREFIX}${workspaceId}`;
  const ownerEmail = `visitor-${workspaceId}@demo.opsflow.invalid`;
  const passwordHash = await hashPassword(`${randomUUID()}${randomUUID()}`);

  const existingStartAt = new Date(
    localWallTimeToUtcIso({
      localDate: scenario.localDate,
      localTime: "09:00",
      timezone: scenario.timezone,
    }),
  );
  const existingEndAt = new Date(
    localWallTimeToUtcIso({
      localDate: scenario.localDate,
      localTime: "10:00",
      timezone: scenario.timezone,
    }),
  );

  return prisma.$transaction(
    async (tx) => {
      await lockDemoWorkspaceCreation(tx);
      await assertDemoWorkspaceCapacity(tx, now);

      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: "OpsFlow Quick Demo",
          slug: tenantSlug,
          status: TenantStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      await tx.demoWorkspace.create({
        data: {
          id: workspaceId,
          tenantId: tenant.id,
          templateVersion: GOLDEN_DEMO_TEMPLATE_VERSION,
          scenario,
          expiresAt,
        },
      });

      await tx.user.createMany({
        data: [
          {
            id: ownerId,
            email: ownerEmail,
            passwordHash,
            displayName: "Demo Visitor",
            demoWorkspaceId: workspaceId,
          },
          {
            id: sofiaId,
            email: `sofia-${workspaceId}@demo.opsflow.invalid`,
            passwordHash,
            displayName: GOLDEN_DEMO_STAFF_NAME,
            demoWorkspaceId: workspaceId,
          },
          {
            id: liamId,
            email: `liam-${workspaceId}@demo.opsflow.invalid`,
            passwordHash,
            displayName: "Liam O'Connor",
            demoWorkspaceId: workspaceId,
          },
        ],
      });

      await tx.membership.createMany({
        data: [
          {
            userId: ownerId,
            tenantId: tenant.id,
            role: MembershipRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
          {
            userId: sofiaId,
            tenantId: tenant.id,
            role: MembershipRole.STAFF,
            status: MembershipStatus.ACTIVE,
          },
          {
            userId: liamId,
            tenantId: tenant.id,
            role: MembershipRole.STAFF,
            status: MembershipStatus.ACTIVE,
          },
        ],
      });

      await tx.customer.createMany({
        data: [
          {
            id: aidenId,
            tenantId: tenant.id,
            name: GOLDEN_DEMO_CUSTOMER_NAME,
            phone: "0412 555 101",
            email: "aiden.murphy@example.com",
            notes: "Prefers afternoon appointments.",
            createdById: ownerId,
          },
          {
            id: oliviaId,
            tenantId: tenant.id,
            name: "Olivia Bennett",
            phone: "0412 555 102",
            email: "olivia.bennett@example.com",
            notes: "Call on arrival.",
            createdById: ownerId,
          },
          {
            id: noahId,
            tenantId: tenant.id,
            name: "Noah Williams",
            phone: "0412 555 103",
            email: "noah.williams@example.com",
            createdById: ownerId,
          },
        ],
      });

      await tx.job.createMany({
        data: [
          {
            id: scheduledJobId,
            tenantId: tenant.id,
            customerId: oliviaId,
            title: "Smoke alarm inspection",
            description: "Annual compliance inspection and battery check.",
            serviceAddress: "27 Bay Street, Port Melbourne VIC 3207",
            status: JobStatus.SCHEDULED,
            assignedToId: sofiaId,
            createdById: ownerId,
            scheduledAt: existingStartAt,
            scheduledStartAt: existingStartAt,
            scheduledEndAt: existingEndAt,
          },
          {
            id: unscheduledJobId,
            tenantId: tenant.id,
            customerId: noahId,
            title: "Kitchen tap leak",
            description: "Inspect and repair a leaking mixer tap.",
            serviceAddress: "44 Lygon Street, Carlton VIC 3053",
            status: JobStatus.NEW,
            createdById: ownerId,
          },
        ],
      });

      const issued = await createSessionAndTokens(tx, {
        userId: ownerId,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        metadata,
        sessionExpiresAt: expiresAt,
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.AUTH_DEMO_SESSION_CREATED,
          tenantId: tenant.id,
          userId: ownerId,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          metadata: {
            demoWorkspaceId: workspaceId,
            templateVersion: GOLDEN_DEMO_TEMPLATE_VERSION,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      const currentTenant = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        role: MembershipRole.OWNER,
      };

      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        expiresInMinutes: Math.min(
          env.JWT_ACCESS_EXPIRES_IN_MINUTES,
          env.DEMO_WORKSPACE_TTL_MINUTES,
        ),
        user: {
          id: ownerId,
          email: ownerEmail,
          displayName: "Demo Visitor",
        },
        currentTenant,
        availableTenants: [currentTenant],
        demoWorkspace: {
          templateVersion: GOLDEN_DEMO_TEMPLATE_VERSION,
          expiresAt,
          scenario,
        },
      };
    },
    {
      timeout: 15_000,
    },
  );
}

export async function consumePrivateDemoAiRequestBudget(tenantId: string) {
  const now = new Date();
  const consumed = await prisma.demoWorkspace.updateMany({
    where: {
      tenantId,
      status: DemoWorkspaceStatus.ACTIVE,
      expiresAt: { gt: now },
      aiRequestsUsed: { lt: env.DEMO_WORKSPACE_AI_REQUEST_LIMIT },
    },
    data: {
      aiRequestsUsed: { increment: 1 },
    },
  });

  if (consumed.count === 1) {
    return;
  }

  const workspace = await prisma.demoWorkspace.findUnique({
    where: { tenantId },
    select: {
      status: true,
      expiresAt: true,
    },
  });

  if (!workspace) {
    return;
  }

  if (
    workspace.status !== DemoWorkspaceStatus.ACTIVE ||
    workspace.expiresAt <= now
  ) {
    throw new AuthError(
      "SESSION_EXPIRED",
      "Quick demo workspace has expired.",
      401,
    );
  }

  throw new ApiError(
    429,
    "This quick demo has reached its AI request limit.",
    "DEMO_AI_REQUEST_LIMIT_REACHED",
  );
}

function cleanupCandidateWhere(now: Date): Prisma.DemoWorkspaceWhereInput {
  const staleLeaseBefore = new Date(now.getTime() - CLEANUP_LEASE_MS);

  return {
    OR: [
      {
        status: DemoWorkspaceStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      {
        status: DemoWorkspaceStatus.CLEANING,
        OR: [
          { cleanupStartedAt: null },
          { cleanupStartedAt: { lte: staleLeaseBefore } },
        ],
      },
    ],
  };
}

async function deleteClaimedDemoWorkspace(input: {
  workspaceId: string;
  tenantId: string;
}) {
  await evidenceStorage.removeTenant(input.tenantId);

  await prisma.$transaction(
    async (tx) => {
      const workspace = await tx.demoWorkspace.findUnique({
        where: { id: input.workspaceId },
        select: {
          id: true,
          tenantId: true,
          status: true,
        },
      });

      if (!workspace) {
        return;
      }

      if (
        workspace.tenantId !== input.tenantId ||
        workspace.status !== DemoWorkspaceStatus.CLEANING
      ) {
        throw new Error("Demo workspace cleanup lease is no longer valid.");
      }

      const ownedUsers = await tx.user.findMany({
        where: { demoWorkspaceId: workspace.id },
        select: { id: true },
      });
      const ownedUserIds = ownedUsers.map((user) => user.id);
      const conversations = await tx.agentConversation.findMany({
        where: { tenantId: workspace.tenantId },
        select: { id: true },
      });
      const conversationIds = conversations.map((conversation) => conversation.id);

      await tx.toolInvocation.deleteMany({ where: { tenantId: workspace.tenantId } });

      if (conversationIds.length > 0) {
        await tx.agentToolCall.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await tx.agentProposal.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await tx.agentMessage.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await tx.agentConversation.deleteMany({
          where: { id: { in: conversationIds } },
        });
      }

      await tx.notification.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.auditLog.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.tenantInvitation.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.authSession.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.jobEvidence.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.jobCompletionReview.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.jobStatusHistory.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.job.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.customer.deleteMany({ where: { tenantId: workspace.tenantId } });
      await tx.membership.deleteMany({ where: { tenantId: workspace.tenantId } });

      if (ownedUserIds.length > 0) {
        const unexpectedMembershipCount = await tx.membership.count({
          where: { userId: { in: ownedUserIds } },
        });

        if (unexpectedMembershipCount > 0) {
          throw new Error(
            "Refusing to delete a temporary demo user with a non-demo membership.",
          );
        }

        await tx.user.deleteMany({
          where: {
            id: { in: ownedUserIds },
            demoWorkspaceId: workspace.id,
          },
        });
      }

      await tx.demoWorkspace.delete({ where: { id: workspace.id } });
      await tx.tenant.delete({ where: { id: workspace.tenantId } });
    },
    {
      timeout: 15_000,
    },
  );
}

export async function cleanupExpiredDemoWorkspaces(
  options: CleanupOptions = {},
): Promise<DemoWorkspaceCleanupResult> {
  const now = options.now ?? new Date();
  const limit = Math.max(
    1,
    Math.min(options.limit ?? env.DEMO_WORKSPACE_CLEANUP_BATCH_SIZE, 500),
  );
  const candidates = await prisma.demoWorkspace.findMany({
    where: cleanupCandidateWhere(now),
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      tenantId: true,
    },
  });

  let claimed = 0;
  let deleted = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const cleanupStartedAt = new Date();
    const claim = await prisma.$transaction(async (tx) => {
      const claimedWorkspace = await tx.demoWorkspace.updateMany({
        where: {
          id: candidate.id,
          ...cleanupCandidateWhere(now),
        },
        data: {
          status: DemoWorkspaceStatus.CLEANING,
          cleanupStartedAt,
        },
      });

      if (claimedWorkspace.count !== 1) {
        return false;
      }

      await tx.tenant.updateMany({
        where: { id: candidate.tenantId },
        data: {
          status: TenantStatus.DEACTIVATED,
          deletedAt: cleanupStartedAt,
        },
      });
      await tx.authSession.updateMany({
        where: {
          tenantId: candidate.tenantId,
          revokedAt: null,
        },
        data: { revokedAt: cleanupStartedAt },
      });

      return true;
    });

    if (!claim) {
      continue;
    }

    claimed += 1;
    closeAgentStreamsForTenant(candidate.tenantId);
    closeNotificationStreamsForTenant(candidate.tenantId);

    try {
      await deleteClaimedDemoWorkspace({
        workspaceId: candidate.id,
        tenantId: candidate.tenantId,
      });
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to clean up quick demo workspace.", {
        workspaceId: candidate.id,
        tenantId: candidate.tenantId,
        error,
      });
    }
  }

  return { claimed, deleted, failed };
}

export function startDemoWorkspaceCleanupScheduler() {
  let running = false;

  const runCleanup = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await cleanupExpiredDemoWorkspaces();
    } catch (error) {
      console.error("Quick demo workspace cleanup cycle failed.", error);
    } finally {
      running = false;
    }
  };

  void runCleanup();

  const timer = setInterval(
    () => void runCleanup(),
    env.DEMO_WORKSPACE_CLEANUP_INTERVAL_SECONDS * 1000,
  );
  timer.unref();

  return () => clearInterval(timer);
}
