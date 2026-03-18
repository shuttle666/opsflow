import { JobStatus, MembershipRole, MembershipStatus, TenantStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { JobDomainError, transitionJobStatus } from "../src/modules/job";

const runDbTests =
  process.env.RUN_DB_TESTS === "true" &&
  process.env.ALLOW_DB_TEST_RESET === "true";
const describeIfDb = runDbTests ? describe : describe.skip;

async function resetDatabase() {
  await prisma.jobStatusHistory.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}

describeIfDb("job transition service + schema constraints", () => {
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

  it("enforces unique user email and membership relation", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: "Tenant One",
        slug: "tenant-one",
      },
    });

    const user = await prisma.user.create({
      data: {
        email: "unique@test.dev",
        passwordHash: "hash",
        displayName: "Unique User",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: "unique@test.dev",
          passwordHash: "hash-2",
          displayName: "Duplicate",
        },
      }),
    ).rejects.toThrow();

    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    await expect(
      prisma.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents cross-tenant job/customer association", async () => {
    const [creator] = await Promise.all([
      prisma.user.create({
        data: {
          email: "creator@test.dev",
          passwordHash: "hash",
          displayName: "Creator",
        },
      }),
    ]);

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Tenant A",
          slug: "tenant-a",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Tenant B",
          slug: "tenant-b",
        },
      }),
    ]);

    const customerB = await prisma.customer.create({
      data: {
        tenantId: tenantB.id,
        name: "Customer B",
        createdById: creator.id,
      },
    });

    await expect(
      prisma.job.create({
        data: {
          tenantId: tenantA.id,
          customerId: customerB.id,
          title: "Invalid job",
          status: JobStatus.NEW,
          createdById: creator.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("applies valid transitions and persists history", async () => {
    const creator = await prisma.user.create({
      data: {
        email: "flow@test.dev",
        passwordHash: "hash",
        displayName: "Flow User",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Flow Tenant",
        slug: "flow-tenant",
      },
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: "Flow Customer",
        createdById: creator.id,
      },
    });

    const job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: "Flow Job",
        status: JobStatus.NEW,
        createdById: creator.id,
      },
    });

    const result = await transitionJobStatus({
      tenantId: tenant.id,
      jobId: job.id,
      toStatus: JobStatus.SCHEDULED,
      changedById: creator.id,
      reason: "Scheduled by manager",
    });

    expect(result.job.status).toBe(JobStatus.SCHEDULED);
    expect(result.history.fromStatus).toBe(JobStatus.NEW);
    expect(result.history.toStatus).toBe(JobStatus.SCHEDULED);

    const history = await prisma.jobStatusHistory.findMany({
      where: { jobId: job.id },
    });
    expect(history).toHaveLength(1);
  });

  it("rejects invalid status transitions", async () => {
    const creator = await prisma.user.create({
      data: {
        email: "invalid@test.dev",
        passwordHash: "hash",
        displayName: "Invalid User",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Invalid Tenant",
        slug: "invalid-tenant",
      },
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: "Invalid Customer",
        createdById: creator.id,
      },
    });

    const job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: "Invalid Transition Job",
        status: JobStatus.COMPLETED,
        createdById: creator.id,
      },
    });

    await expect(
      transitionJobStatus({
        tenantId: tenant.id,
        jobId: job.id,
        toStatus: JobStatus.IN_PROGRESS,
        changedById: creator.id,
      }),
    ).rejects.toMatchObject<JobDomainError>({
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("rolls back job update if history insertion fails", async () => {
    const creator = await prisma.user.create({
      data: {
        email: "rollback@test.dev",
        passwordHash: "hash",
        displayName: "Rollback User",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Rollback Tenant",
        slug: "rollback-tenant",
      },
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: "Rollback Customer",
        createdById: creator.id,
      },
    });

    const job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: "Rollback Job",
        status: JobStatus.NEW,
        createdById: creator.id,
      },
    });

    await expect(
      transitionJobStatus({
        tenantId: tenant.id,
        jobId: job.id,
        toStatus: JobStatus.SCHEDULED,
        changedById: "90000000-0000-4000-8000-000000000999",
      }),
    ).rejects.toThrow();

    const reloaded = await prisma.job.findUnique({ where: { id: job.id } });
    const history = await prisma.jobStatusHistory.findMany({
      where: { jobId: job.id },
    });

    expect(reloaded?.status).toBe(JobStatus.NEW);
    expect(history).toHaveLength(0);
  });

  it("blocks transitions for soft-deleted tenants", async () => {
    const creator = await prisma.user.create({
      data: {
        email: "inactive@test.dev",
        passwordHash: "hash",
        displayName: "Inactive User",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Inactive Tenant",
        slug: "inactive-tenant",
        status: TenantStatus.DEACTIVATED,
        deletedAt: new Date(),
      },
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: "Inactive Customer",
        createdById: creator.id,
      },
    });

    const job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: "Inactive Job",
        status: JobStatus.NEW,
        createdById: creator.id,
      },
    });

    await expect(
      transitionJobStatus({
        tenantId: tenant.id,
        jobId: job.id,
        toStatus: JobStatus.SCHEDULED,
        changedById: creator.id,
      }),
    ).rejects.toMatchObject<JobDomainError>({
      code: "TENANT_INACTIVE",
    });
  });
});
