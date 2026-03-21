import { AuditAction, JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("activity api integration", () => {
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

  async function seedTenantUser(input: {
    email: string;
    displayName: string;
    role: MembershipRole;
    tenantName: string;
    tenantSlug: string;
  }) {
    const passwordHash = await hashPassword("password123");
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
          passwordHash,
          displayName: input.displayName,
        },
      }),
    ]);

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: input.role,
        status: MembershipStatus.ACTIVE,
      },
    });

    const session = await login({
      email: user.email,
      password: "password123",
      tenantId: tenant.id,
    });

    return {
      tenant,
      user,
      membership,
      accessToken: session.accessToken,
    };
  }

  it("returns recent workflow, assignment, and membership activity items", async () => {
    const owner = await seedTenantUser({
      email: "owner@activity-api.test",
      displayName: "Activity Owner",
      role: MembershipRole.OWNER,
      tenantName: "Activity Tenant",
      tenantSlug: "activity-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffUser, managerUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff@activity-api.test",
          passwordHash,
          displayName: "Activity Staff",
        },
      }),
      prisma.user.create({
        data: {
          email: "manager@activity-api.test",
          passwordHash,
          displayName: "Activity Manager",
        },
      }),
    ]);

    const [staffMembership, managerMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: staffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: managerUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Activity Customer",
      },
    });
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Activity Job",
        status: JobStatus.NEW,
        createdById: owner.user.id,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: owner.tenant.id,
          userId: owner.user.id,
          action: AuditAction.MEMBERSHIP_UPDATED,
          targetType: "membership",
          targetId: managerMembership.id,
          metadata: {
            memberEmail: managerUser.email,
            previousRole: MembershipRole.MANAGER,
            nextRole: MembershipRole.MANAGER,
            previousStatus: MembershipStatus.ACTIVE,
            nextStatus: MembershipStatus.ACTIVE,
          },
          createdAt: new Date("2026-03-20T01:00:00.000Z"),
        },
        {
          tenantId: owner.tenant.id,
          userId: owner.user.id,
          action: AuditAction.JOB_ASSIGNED,
          targetType: "job",
          targetId: job.id,
          metadata: {
            jobTitle: job.title,
            assigneeName: staffUser.displayName,
            assigneeEmail: staffUser.email,
          },
          createdAt: new Date("2026-03-20T02:00:00.000Z"),
        },
        {
          tenantId: owner.tenant.id,
          userId: staffUser.id,
          action: AuditAction.JOB_STATUS_TRANSITION,
          targetType: "job",
          targetId: job.id,
          metadata: {
            fromStatus: JobStatus.NEW,
            toStatus: JobStatus.SCHEDULED,
            reason: "Booked for morning visit.",
          },
          createdAt: new Date("2026-03-20T03:00:00.000Z"),
        },
      ],
    });

    const response = await request(app)
      .get("/api/activity?page=1&pageSize=10")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data[0]?.title).toBe("Status moved to SCHEDULED");
    expect(response.body.data[1]?.title).toBe("Job assigned");
    expect(response.body.data[2]?.title).toBe("Team member updated");
    expect(response.body.meta.pagination.total).toBe(3);
    expect(staffMembership.role).toBe(MembershipRole.STAFF);
  });
});
