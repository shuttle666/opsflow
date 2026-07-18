import {
  JobEvidenceKind,
  JobStatus,
  MembershipRole,
  MembershipStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { describeIfDb, resetDatabase } from "./helpers/db";

async function seedTenantBoundary() {
  const [tenantA, tenantB, userA, userB] = await Promise.all([
    prisma.tenant.create({
      data: {
        name: "Integrity Tenant A",
        slug: "integrity-tenant-a",
      },
    }),
    prisma.tenant.create({
      data: {
        name: "Integrity Tenant B",
        slug: "integrity-tenant-b",
      },
    }),
    prisma.user.create({
      data: {
        email: "owner-a@tenant-integrity.test",
        passwordHash: "hash-a",
        displayName: "Tenant A Owner",
      },
    }),
    prisma.user.create({
      data: {
        email: "owner-b@tenant-integrity.test",
        passwordHash: "hash-b",
        displayName: "Tenant B Owner",
      },
    }),
  ]);

  await prisma.membership.createMany({
    data: [
      {
        tenantId: tenantA.id,
        userId: userA.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      {
        tenantId: tenantB.id,
        userId: userB.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    ],
  });

  const customerA = await prisma.customer.create({
    data: {
      tenantId: tenantA.id,
      name: "Integrity Customer A",
      createdById: userA.id,
    },
  });
  const jobA = await prisma.job.create({
    data: {
      tenantId: tenantA.id,
      customerId: customerA.id,
      title: "Tenant A Job",
      serviceAddress: "18 Collins Street, Melbourne VIC 3000",
      createdById: userA.id,
    },
  });

  return { jobA, tenantA, tenantB, userA, userB };
}

async function expectCompositeForeignKeyViolation(operation: Promise<unknown>) {
  await expect(operation).rejects.toMatchObject({ code: "P2003" });
}

describeIfDb("database tenant integrity", () => {
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

  it("rejects cross-tenant JobEvidence to Job writes while allowing the matching tenant", async () => {
    const { jobA, tenantA, tenantB, userA, userB } = await seedTenantBoundary();

    await expectCompositeForeignKeyViolation(
      prisma.jobEvidence.create({
        data: {
          tenantId: tenantB.id,
          jobId: jobA.id,
          uploadedById: userB.id,
          kind: JobEvidenceKind.COMPLETION_PROOF,
          fileName: "cross-tenant-proof.png",
          mimeType: "image/png",
          sizeBytes: 1,
          storageKey: "tenant-b/cross-tenant-proof.png",
        },
      }),
    );

    const evidence = await prisma.jobEvidence.create({
      data: {
        tenantId: tenantA.id,
        jobId: jobA.id,
        uploadedById: userA.id,
        kind: JobEvidenceKind.COMPLETION_PROOF,
        fileName: "same-tenant-proof.png",
        mimeType: "image/png",
        sizeBytes: 1,
        storageKey: "tenant-a/same-tenant-proof.png",
      },
    });

    expect(evidence).toMatchObject({
      tenantId: tenantA.id,
      jobId: jobA.id,
    });
  });

  it("rejects cross-tenant JobCompletionReview to Job writes while allowing the matching tenant", async () => {
    const { jobA, tenantA, tenantB, userA, userB } = await seedTenantBoundary();

    await expectCompositeForeignKeyViolation(
      prisma.jobCompletionReview.create({
        data: {
          tenantId: tenantB.id,
          jobId: jobA.id,
          submittedById: userB.id,
          completionNote: "Cross-tenant completion attempt.",
        },
      }),
    );

    const review = await prisma.jobCompletionReview.create({
      data: {
        tenantId: tenantA.id,
        jobId: jobA.id,
        submittedById: userA.id,
        completionNote: "Same-tenant completion review.",
      },
    });

    expect(review).toMatchObject({
      tenantId: tenantA.id,
      jobId: jobA.id,
    });
  });

  it("rejects cross-tenant JobStatusHistory to Job writes while allowing the matching tenant", async () => {
    const { jobA, tenantA, tenantB, userA, userB } = await seedTenantBoundary();

    await expectCompositeForeignKeyViolation(
      prisma.jobStatusHistory.create({
        data: {
          tenantId: tenantB.id,
          jobId: jobA.id,
          fromStatus: JobStatus.NEW,
          toStatus: JobStatus.SCHEDULED,
          changedById: userB.id,
          reason: "Cross-tenant status attempt.",
        },
      }),
    );

    const history = await prisma.jobStatusHistory.create({
      data: {
        tenantId: tenantA.id,
        jobId: jobA.id,
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.SCHEDULED,
        changedById: userA.id,
        reason: "Same-tenant status change.",
      },
    });

    expect(history).toMatchObject({
      tenantId: tenantA.id,
      jobId: jobA.id,
    });
  });
});
