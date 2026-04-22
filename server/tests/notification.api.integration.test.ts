import { JobStatus, MembershipRole, MembershipStatus, NotificationType } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("notification api integration", () => {
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

  async function seedWorkspace() {
    const passwordHash = await hashPassword("password123");
    const tenant = await prisma.tenant.create({
      data: {
        name: "Notification Tenant",
        slug: "notification-tenant",
      },
    });
    const [ownerUser, managerUser, staffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner@notification.test",
          passwordHash,
          displayName: "Owner Notifications",
        },
      }),
      prisma.user.create({
        data: {
          email: "manager@notification.test",
          passwordHash,
          displayName: "Manager Notifications",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff@notification.test",
          passwordHash,
          displayName: "Staff Notifications",
        },
      }),
    ]);
    const [, staffMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: managerUser.id,
          tenantId: tenant.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: staffUser.id,
          tenantId: tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: ownerUser.id,
          tenantId: tenant.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        createdById: ownerUser.id,
        name: "Noah Notifications",
      },
    });
    const job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: "Notification Test Job",
        serviceAddress: "18 Collins Street, Melbourne VIC 3000",
        status: JobStatus.NEW,
        createdById: ownerUser.id,
      },
    });
    const [managerSession, staffSession] = await Promise.all([
      login({
        email: managerUser.email,
        password: "password123",
        tenantId: tenant.id,
      }),
      login({
        email: staffUser.email,
        password: "password123",
        tenantId: tenant.id,
      }),
    ]);

    return {
      job,
      staffMembership,
      managerToken: managerSession.accessToken,
      staffToken: staffSession.accessToken,
    };
  }

  it("creates unread assignment notifications and allows the recipient to read them", async () => {
    const { job, staffMembership, managerToken, staffToken } = await seedWorkspace();

    const assigned = await request(app)
      .post(`/api/jobs/${job.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        membershipId: staffMembership.id,
      });

    expect(assigned.status).toBe(200);

    const unreadCount = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(unreadCount.status).toBe(200);
    expect(unreadCount.body.data.unreadCount).toBe(1);

    const notifications = await request(app)
      .get("/api/notifications?status=unread")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(notifications.status).toBe(200);
    expect(notifications.body.data).toHaveLength(1);
    expect(notifications.body.data[0].type).toBe(NotificationType.JOB_ASSIGNED);
    expect(notifications.body.data[0].targetId).toBe(job.id);

    const read = await request(app)
      .patch(`/api/notifications/${notifications.body.data[0].id}/read`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();

    const nextUnreadCount = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(nextUnreadCount.body.data.unreadCount).toBe(0);
  });

  it("keeps notifications private to the recipient", async () => {
    const { job, staffMembership, managerToken, staffToken } = await seedWorkspace();

    await request(app)
      .post(`/api/jobs/${job.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        membershipId: staffMembership.id,
      });

    const staffNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${staffToken}`);
    const notificationId = staffNotifications.body.data[0].id;

    const managerNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(managerNotifications.status).toBe(200);
    expect(managerNotifications.body.data).toHaveLength(0);

    const forbiddenRead = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(forbiddenRead.status).toBe(404);
  });
});
