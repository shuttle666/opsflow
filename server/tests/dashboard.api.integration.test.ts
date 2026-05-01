import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("dashboard api integration", () => {
  const app = createApp();

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

  async function seedTenant(input: {
    name: string;
    slug: string;
    ownerEmail: string;
  }) {
    const passwordHash = await hashPassword("password123");
    const [tenant, owner] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
        },
      }),
      prisma.user.create({
        data: {
          email: input.ownerEmail,
          passwordHash,
          displayName: "Owner User",
        },
      }),
    ]);

    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const session = await login({
      email: owner.email,
      password: "password123",
      tenantId: tenant.id,
    });

    return {
      tenant,
      owner,
      ownerAccessToken: session.accessToken,
    };
  }

  async function seedMember(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: MembershipRole;
    status?: MembershipStatus;
  }) {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword("password123"),
        displayName: input.displayName,
      },
    });
    const membership = await prisma.membership.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        role: input.role,
        status: input.status ?? MembershipStatus.ACTIVE,
      },
    });
    const session =
      membership.status === MembershipStatus.ACTIVE
        ? await login({
            email: user.email,
            password: "password123",
            tenantId: input.tenantId,
          })
        : null;

    return {
      user,
      membership,
      accessToken: session?.accessToken,
    };
  }

  async function seedCustomer(tenantId: string, createdById: string, name: string) {
    return prisma.customer.create({
      data: {
        tenantId,
        createdById,
        name,
      },
    });
  }

  async function seedJob(input: {
    tenantId: string;
    customerId: string;
    createdById: string;
    assignedToId?: string;
    title: string;
    status: JobStatus;
    scheduledStartAt: string;
    scheduledEndAt: string;
  }) {
    return prisma.job.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        createdById: input.createdById,
        assignedToId: input.assignedToId,
        title: input.title,
        serviceAddress: "18 Collins Street, Melbourne VIC 3000",
        status: input.status,
        scheduledAt: new Date(input.scheduledStartAt),
        scheduledStartAt: new Date(input.scheduledStartAt),
        scheduledEndAt: new Date(input.scheduledEndAt),
      },
    });
  }

  it("returns full tenant dashboard metrics, preview rows, attention ordering, and conflicts", async () => {
    const owner = await seedTenant({
      name: "Dashboard Tenant",
      slug: "dashboard-tenant",
      ownerEmail: "owner@dashboard.test",
    });
    const [manager, staffOne, staffTwo, disabledStaff] = await Promise.all([
      seedMember({
        tenantId: owner.tenant.id,
        email: "manager@dashboard.test",
        displayName: "Maya Manager",
        role: MembershipRole.MANAGER,
      }),
      seedMember({
        tenantId: owner.tenant.id,
        email: "staff-one@dashboard.test",
        displayName: "Ivy Installer",
        role: MembershipRole.STAFF,
      }),
      seedMember({
        tenantId: owner.tenant.id,
        email: "staff-two@dashboard.test",
        displayName: "Sam Specialist",
        role: MembershipRole.STAFF,
      }),
      seedMember({
        tenantId: owner.tenant.id,
        email: "disabled@dashboard.test",
        displayName: "Disabled Staff",
        role: MembershipRole.STAFF,
        status: MembershipStatus.DISABLED,
      }),
    ]);
    expect(disabledStaff.membership.status).toBe(MembershipStatus.DISABLED);

    const customer = await seedCustomer(
      owner.tenant.id,
      owner.owner.id,
      "Noah Thompson",
    );

    await Promise.all([
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffOne.user.id,
        title: "Pending review work",
        status: JobStatus.PENDING_REVIEW,
        scheduledStartAt: "2026-05-02T01:00:00.000Z",
        scheduledEndAt: "2026-05-02T02:00:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffOne.user.id,
        title: "Overlapping repair A",
        status: JobStatus.SCHEDULED,
        scheduledStartAt: "2026-05-02T03:00:00.000Z",
        scheduledEndAt: "2026-05-02T04:00:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffOne.user.id,
        title: "Overlapping repair B",
        status: JobStatus.SCHEDULED,
        scheduledStartAt: "2026-05-02T03:30:00.000Z",
        scheduledEndAt: "2026-05-02T04:30:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffTwo.user.id,
        title: "New assigned work",
        status: JobStatus.NEW,
        scheduledStartAt: "2026-05-02T05:00:00.000Z",
        scheduledEndAt: "2026-05-02T06:00:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        title: "Scheduled but unassigned",
        status: JobStatus.SCHEDULED,
        scheduledStartAt: "2026-05-02T07:00:00.000Z",
        scheduledEndAt: "2026-05-02T08:00:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: manager.user.id,
        title: "Normal scheduled work",
        status: JobStatus.SCHEDULED,
        scheduledStartAt: "2026-05-02T09:00:00.000Z",
        scheduledEndAt: "2026-05-02T10:00:00.000Z",
      }),
    ]);

    const response = await request(app)
      .get(
        "/api/dashboard/summary?date=2026-05-02&schedulePreviewLimit=2&attentionLimit=4",
      )
      .set("Authorization", `Bearer ${owner.ownerAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toMatchObject({
      todayJobs: 6,
      scheduledRows: 6,
      assignedJobs: 5,
      pendingReview: 1,
      unassignedJobs: 1,
      activeCrewScheduled: 3,
      activeCrewTotal: 4,
      needsAttention: 5,
      conflictCount: 2,
    });
    expect(response.body.data.schedulePreview).toHaveLength(2);
    expect(response.body.data.attentionItems.map((item: { reason: string }) => item.reason)).toEqual([
      "PENDING_REVIEW",
      "SCHEDULE_CONFLICT",
      "SCHEDULE_CONFLICT",
      "NEW_JOB",
    ]);
  });

  it("scopes staff dashboard summaries to assigned work only", async () => {
    const owner = await seedTenant({
      name: "Staff Dashboard Tenant",
      slug: "staff-dashboard-tenant",
      ownerEmail: "owner@staff-dashboard.test",
    });
    const [staffOne, staffTwo] = await Promise.all([
      seedMember({
        tenantId: owner.tenant.id,
        email: "staff-one@staff-dashboard.test",
        displayName: "Staff One",
        role: MembershipRole.STAFF,
      }),
      seedMember({
        tenantId: owner.tenant.id,
        email: "staff-two@staff-dashboard.test",
        displayName: "Staff Two",
        role: MembershipRole.STAFF,
      }),
    ]);
    const customer = await seedCustomer(
      owner.tenant.id,
      owner.owner.id,
      "Ava Customer",
    );

    await Promise.all([
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffOne.user.id,
        title: "Staff one work",
        status: JobStatus.SCHEDULED,
        scheduledStartAt: "2026-05-02T01:00:00.000Z",
        scheduledEndAt: "2026-05-02T02:00:00.000Z",
      }),
      seedJob({
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.owner.id,
        assignedToId: staffTwo.user.id,
        title: "Staff two work",
        status: JobStatus.PENDING_REVIEW,
        scheduledStartAt: "2026-05-02T03:00:00.000Z",
        scheduledEndAt: "2026-05-02T04:00:00.000Z",
      }),
    ]);

    const response = await request(app)
      .get("/api/dashboard/summary?date=2026-05-02")
      .set("Authorization", `Bearer ${staffOne.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.metrics.todayJobs).toBe(1);
    expect(response.body.data.metrics.pendingReview).toBe(0);
    expect(response.body.data.schedulePreview).toHaveLength(1);
    expect(response.body.data.schedulePreview[0].jobType).toBe("Staff one work");
  });

  it("keeps tenant data isolated and rejects invalid summary queries", async () => {
    const primary = await seedTenant({
      name: "Primary Dashboard Tenant",
      slug: "primary-dashboard-tenant",
      ownerEmail: "owner@primary-dashboard.test",
    });
    const secondary = await seedTenant({
      name: "Secondary Dashboard Tenant",
      slug: "secondary-dashboard-tenant",
      ownerEmail: "owner@secondary-dashboard.test",
    });
    const primaryCustomer = await seedCustomer(
      primary.tenant.id,
      primary.owner.id,
      "Primary Customer",
    );
    const secondaryCustomer = await seedCustomer(
      secondary.tenant.id,
      secondary.owner.id,
      "Secondary Customer",
    );

    await Promise.all([
      seedJob({
        tenantId: primary.tenant.id,
        customerId: primaryCustomer.id,
        createdById: primary.owner.id,
        title: "Primary work",
        status: JobStatus.NEW,
        scheduledStartAt: "2026-05-02T01:00:00.000Z",
        scheduledEndAt: "2026-05-02T02:00:00.000Z",
      }),
      seedJob({
        tenantId: secondary.tenant.id,
        customerId: secondaryCustomer.id,
        createdById: secondary.owner.id,
        title: "Secondary work",
        status: JobStatus.NEW,
        scheduledStartAt: "2026-05-02T01:00:00.000Z",
        scheduledEndAt: "2026-05-02T02:00:00.000Z",
      }),
    ]);

    const isolated = await request(app)
      .get("/api/dashboard/summary?date=2026-05-02")
      .set("Authorization", `Bearer ${primary.ownerAccessToken}`);
    expect(isolated.status).toBe(200);
    expect(isolated.body.data.metrics.todayJobs).toBe(1);
    expect(isolated.body.data.schedulePreview[0].jobType).toBe("Primary work");

    const invalidDate = await request(app)
      .get("/api/dashboard/summary?date=not-a-date")
      .set("Authorization", `Bearer ${primary.ownerAccessToken}`);
    expect(invalidDate.status).toBe(400);

    const invalidLimit = await request(app)
      .get("/api/dashboard/summary?date=2026-05-02&schedulePreviewLimit=21")
      .set("Authorization", `Bearer ${primary.ownerAccessToken}`);
    expect(invalidLimit.status).toBe(400);
  });
});
