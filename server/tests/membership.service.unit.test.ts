import {
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const serviceMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $transaction: serviceMocks.transaction,
  },
}));

vi.mock("../src/modules/auth/auth.service", () => ({
  expirePendingTenantInvitations: vi.fn(),
}));

import { updateMembership } from "../src/modules/membership/membership.service";

const auth: AuthContext = {
  userId: "actor-user",
  sessionId: "actor-session",
  tenantId: "tenant-1",
  role: MembershipRole.OWNER,
};

const activeOwnerActor = {
  role: MembershipRole.OWNER,
  status: MembershipStatus.ACTIVE,
  tenant: {
    status: TenantStatus.ACTIVE,
    deletedAt: null,
  },
};

function buildTransaction(actorMembership: unknown) {
  return {
    membership: {
      findUnique: vi.fn().mockResolvedValue(actorMembership),
      findFirst: vi.fn().mockResolvedValue({
        id: "target-membership",
        userId: "target-user",
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      }),
      update: vi.fn().mockResolvedValue({
        id: "target-membership",
        userId: "target-user",
        role: MembershipRole.MANAGER,
        status: MembershipStatus.ACTIVE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          displayName: "Target User",
          email: "target@example.test",
        },
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

function serializableConflict() {
  const error = new Error("TransactionWriteConflict");
  error.name = "DriverAdapterError";
  return error;
}

describe("membership update authorization retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      label: "demoted",
      actor: {
        ...activeOwnerActor,
        role: MembershipRole.MANAGER,
      },
      code: "AUTH_FORBIDDEN_ROLE",
    },
    {
      label: "disabled",
      actor: {
        ...activeOwnerActor,
        status: MembershipStatus.DISABLED,
      },
      code: "AUTH_MEMBERSHIP_INACTIVE",
    },
    {
      label: "in an inactive tenant",
      actor: {
        ...activeOwnerActor,
        tenant: {
          status: TenantStatus.DEACTIVATED,
          deletedAt: null,
        },
      },
      code: "AUTH_TENANT_INACTIVE",
    },
  ])(
    "revalidates a caller who becomes $label before a Serializable retry",
    async ({ actor, code }) => {
      const firstAttempt = buildTransaction(activeOwnerActor);
      const secondAttempt = buildTransaction(actor);
      let attempt = 0;

      serviceMocks.transaction.mockImplementation(
        async (
          operation: (
            tx: ReturnType<typeof buildTransaction>,
          ) => Promise<unknown>,
        ) => {
          attempt += 1;
          const transaction = attempt === 1 ? firstAttempt : secondAttempt;
          const result = await operation(transaction);

          if (attempt === 1) {
            throw serializableConflict();
          }

          return result;
        },
      );

      await expect(
        updateMembership(auth, "target-membership", {
          role: MembershipRole.MANAGER,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code,
      });

      expect(serviceMocks.transaction).toHaveBeenCalledTimes(2);
      expect(firstAttempt.membership.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_tenantId: {
              userId: auth.userId,
              tenantId: auth.tenantId,
            },
          },
        }),
      );
      expect(secondAttempt.membership.findUnique).toHaveBeenCalledTimes(1);
      expect(secondAttempt.membership.findFirst).not.toHaveBeenCalled();
      expect(secondAttempt.membership.update).not.toHaveBeenCalled();
      expect(secondAttempt.auditLog.create).not.toHaveBeenCalled();
    },
  );
});
