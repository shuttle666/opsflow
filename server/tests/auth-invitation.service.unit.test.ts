import {
  InvitationStatus,
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const serviceMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $transaction: serviceMocks.transaction,
    user: {
      findUnique: serviceMocks.userFindUnique,
    },
    tenantInvitation: {
      findUnique: serviceMocks.invitationFindUnique,
    },
  },
}));

import {
  acceptTenantInvitationById,
  createTenantInvitation,
} from "../src/modules/auth/auth.service";

const auth: AuthContext = {
  userId: "actor-user",
  sessionId: "actor-session",
  tenantId: "tenant-1",
  role: MembershipRole.OWNER,
};

function buildTransaction(
  existingStatus: MembershipStatus,
  actorRole = MembershipRole.OWNER,
) {
  const membershipUpdate = vi.fn().mockResolvedValue({});
  const membershipCreate = vi.fn().mockResolvedValue({});
  const invitationCreate = vi.fn().mockResolvedValue({
    id: "invitation-1",
    tenantId: auth.tenantId,
    email: "invitee@example.test",
    role: MembershipRole.STAFF,
    expiresAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });

  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        status: TenantStatus.ACTIVE,
        deletedAt: null,
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "invitee-user" }),
    },
    membership: {
      findUnique: vi.fn().mockImplementation(async (query) => {
        const userId = query.where.userId_tenantId.userId;
        if (userId === auth.userId) {
          return {
            role: actorRole,
            status: MembershipStatus.ACTIVE,
          };
        }

        return {
          id: "invitee-membership",
          status: existingStatus,
        };
      }),
      update: membershipUpdate,
      create: membershipCreate,
    },
    tenantInvitation: {
      create: invitationCreate,
    },
    auditLog: {
      create: auditCreate,
    },
  };
}

function serializableConflict() {
  const error = new Error("TransactionWriteConflict");
  error.name = "DriverAdapterError";
  return error;
}

describe("tenant invitation creation authorization retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechecks membership state after a conflict and never reverts an active member to invited", async () => {
    const firstAttempt = buildTransaction(MembershipStatus.INVITED);
    const secondAttempt = buildTransaction(MembershipStatus.ACTIVE);
    let attempt = 0;

    serviceMocks.transaction.mockImplementation(async (operation) => {
      attempt += 1;
      const transaction = attempt === 1 ? firstAttempt : secondAttempt;
      const result = await operation(transaction);

      if (attempt === 1) {
        throw serializableConflict();
      }

      return result;
    });

    await expect(
      createTenantInvitation(
        auth,
        auth.tenantId,
        {
          email: "invitee@example.test",
          role: MembershipRole.STAFF,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "User is already an active member in this tenant.",
    });

    expect(serviceMocks.transaction).toHaveBeenCalledTimes(2);
    expect(firstAttempt.membership.update).toHaveBeenCalledTimes(1);
    expect(firstAttempt.tenantInvitation.create).toHaveBeenCalledTimes(1);
    expect(secondAttempt.membership.update).not.toHaveBeenCalled();
    expect(secondAttempt.membership.create).not.toHaveBeenCalled();
    expect(secondAttempt.tenantInvitation.create).not.toHaveBeenCalled();
    expect(secondAttempt.auditLog.create).not.toHaveBeenCalled();
  });

  it("preserves the API contract that an active manager can invite staff", async () => {
    const transaction = buildTransaction(
      MembershipStatus.INVITED,
      MembershipRole.MANAGER,
    );
    serviceMocks.transaction.mockImplementation((operation) =>
      operation(transaction),
    );

    await expect(
      createTenantInvitation(auth, auth.tenantId, {
        email: "invitee@example.test",
        role: MembershipRole.STAFF,
      }),
    ).resolves.toMatchObject({
      id: "invitation-1",
      tenantId: auth.tenantId,
      role: MembershipRole.STAFF,
    });

    expect(transaction.membership.update).toHaveBeenCalledWith({
      where: { id: "invitee-membership" },
      data: {
        role: MembershipRole.STAFF,
        status: MembershipStatus.INVITED,
      },
    });
    expect(transaction.tenantInvitation.create).toHaveBeenCalledTimes(1);
    expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not let a legacy pending invitation reactivate a disabled member", async () => {
    const pendingInvitation = {
      id: "legacy-invitation",
      tenantId: auth.tenantId,
      email: "actor@example.test",
      role: MembershipRole.STAFF,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      tenant: {
        status: TenantStatus.ACTIVE,
        deletedAt: null,
      },
    };
    serviceMocks.userFindUnique.mockResolvedValue({
      id: auth.userId,
      email: pendingInvitation.email,
      isActive: true,
    });
    serviceMocks.invitationFindUnique.mockResolvedValue(pendingInvitation);

    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          email: pendingInvitation.email,
          isActive: true,
        }),
      },
      tenantInvitation: {
        findUnique: vi.fn().mockResolvedValue(pendingInvitation),
        updateMany: vi.fn(),
      },
      membership: {
        findUnique: vi.fn().mockResolvedValue({
          id: "disabled-membership",
          status: MembershipStatus.DISABLED,
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };
    serviceMocks.transaction.mockImplementation((operation) =>
      operation(transaction),
    );

    await expect(
      acceptTenantInvitationById(auth, pendingInvitation.id),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "AUTH_INVITATION_ALREADY_USED",
      message: "User membership is not awaiting an invitation.",
    });

    expect(transaction.tenantInvitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.membership.update).not.toHaveBeenCalled();
    expect(transaction.membership.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
