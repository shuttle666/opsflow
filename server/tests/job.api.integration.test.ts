import { AuditAction, JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("job api integration", () => {
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

    await prisma.membership.create({
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
      accessToken: session.accessToken,
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

  it("returns 401 for unauthenticated job list requests", async () => {
    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("allows owner to create/list/detail/update jobs", async () => {
    const { tenant, user, accessToken } = await seedTenantUser({
      email: "owner@job-api.test",
      displayName: "Owner API",
      role: MembershipRole.OWNER,
      tenantName: "Job API Tenant",
      tenantSlug: "job-api-tenant",
    });
    const customer = await seedCustomer(tenant.id, user.id, "Noah Thompson");

    const created = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customerId: customer.id,
        title: "Leaking kitchen tap",
        description: "Tap leaking overnight.",
        scheduledStartAt: "2026-03-30T02:00:00.000Z",
        scheduledEndAt: "2026-03-30T03:00:00.000Z",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("NEW");

    const listed = await request(app)
      .get(`/api/jobs?q=Noah&status=${JobStatus.NEW}&customerId=${customer.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.pagination.total).toBe(1);

    const detail = await request(app)
      .get(`/api/jobs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.customer.name).toBe("Noah Thompson");
    expect(detail.body.data.createdBy.email).toBe("owner@job-api.test");

    const updated = await request(app)
      .patch(`/api/jobs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customerId: customer.id,
        title: "Leaking kitchen tap updated",
        description: "",
        scheduledStartAt: "",
        scheduledEndAt: "",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Leaking kitchen tap updated");
  });

  it("allows owner and manager to assign jobs, while staff only sees assigned work", async () => {
    const owner = await seedTenantUser({
      email: "owner@job-rbac.test",
      displayName: "Owner RBAC",
      role: MembershipRole.OWNER,
      tenantName: "Job RBAC Tenant",
      tenantSlug: "job-rbac-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [managerUser, staffUser, otherStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "manager@job-rbac.test",
          passwordHash,
          displayName: "Manager RBAC",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff@job-rbac.test",
          passwordHash,
          displayName: "Staff RBAC",
        },
      }),
      prisma.user.create({
        data: {
          email: "other-staff@job-rbac.test",
          passwordHash,
          displayName: "Other Staff",
        },
      }),
    ]);

    const [managerMembership, staffMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: managerUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: staffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);
    await prisma.membership.create({
      data: {
        userId: otherStaffUser.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const managerSession = await login({
      email: managerUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });
    const staffSession = await login({
      email: staffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });
    const otherStaffSession = await login({
      email: otherStaffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });

    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Staff Forbidden");
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Existing Job",
        status: JobStatus.NEW,
        createdById: owner.user.id,
      },
    });

    const assignRes = await request(app)
      .post(`/api/jobs/${job.id}/assign`)
      .set("Authorization", `Bearer ${managerSession.accessToken}`)
      .send({
        membershipId: staffMembership.id,
      });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assignedTo.email).toBe("staff@job-rbac.test");

    const myJobs = await request(app)
      .get("/api/jobs/my")
      .set("Authorization", `Bearer ${staffSession.accessToken}`);
    expect(myJobs.status).toBe(200);
    expect(myJobs.body.data).toHaveLength(1);
    expect(myJobs.body.data[0]?.id).toBe(job.id);

    const unassignedList = await request(app)
      .get("/api/jobs/my")
      .set("Authorization", `Bearer ${otherStaffSession.accessToken}`);
    expect(unassignedList.status).toBe(200);
    expect(unassignedList.body.data).toHaveLength(0);

    const ownDetail = await request(app)
      .get(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`);
    expect(ownDetail.status).toBe(200);

    const hiddenDetail = await request(app)
      .get(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${otherStaffSession.accessToken}`);
    expect(hiddenDetail.status).toBe(404);

    const createRes = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        customerId: customer.id,
        title: "Blocked Job",
      });
    expect(createRes.status).toBe(403);

    const listRes = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${staffSession.accessToken}`);
    expect(listRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        customerId: customer.id,
        title: "Blocked Edit",
      });
    expect(patchRes.status).toBe(403);

    const unassignRes = await request(app)
      .post(`/api/jobs/${job.id}/unassign`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(unassignRes.status).toBe(200);
    expect(unassignRes.body.data.assignedTo).toBeUndefined();

    const assignmentAuditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        targetId: job.id,
        action: {
          in: [AuditAction.JOB_ASSIGNED, AuditAction.JOB_UNASSIGNED],
        },
      },
    });
    expect(assignmentAuditLogs).toHaveLength(2);

    const managerList = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${managerSession.accessToken}`);
    expect(managerList.status).toBe(200);
    expect(managerList.body.data).toHaveLength(1);
    expect(managerMembership.role).toBe(MembershipRole.MANAGER);
  });

  it("loads schedule ranges and enforces staff range visibility", async () => {
    const owner = await seedTenantUser({
      email: "owner@schedule-range-api.test",
      displayName: "Schedule Range Owner",
      role: MembershipRole.OWNER,
      tenantName: "Schedule Range API Tenant",
      tenantSlug: "schedule-range-api-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffUser, otherStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff@schedule-range-api.test",
          passwordHash,
          displayName: "Schedule Staff",
        },
      }),
      prisma.user.create({
        data: {
          email: "other-staff@schedule-range-api.test",
          passwordHash,
          displayName: "Other Schedule Staff",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: staffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: otherStaffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const staffSession = await login({
      email: staffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });

    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Schedule Range Customer");
    await prisma.job.createMany({
      data: [
        {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "First API overlap",
          status: JobStatus.SCHEDULED,
          createdById: owner.user.id,
          assignedToId: staffUser.id,
          scheduledStartAt: new Date("2026-04-07T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-07T02:00:00.000Z"),
          scheduledAt: new Date("2026-04-07T00:00:00.000Z"),
        },
        {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Second API overlap",
          status: JobStatus.SCHEDULED,
          createdById: owner.user.id,
          assignedToId: staffUser.id,
          scheduledStartAt: new Date("2026-04-07T01:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-07T03:00:00.000Z"),
          scheduledAt: new Date("2026-04-07T01:00:00.000Z"),
        },
        {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Other staff API job",
          status: JobStatus.SCHEDULED,
          createdById: owner.user.id,
          assignedToId: otherStaffUser.id,
          scheduledStartAt: new Date("2026-04-08T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-08T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-08T00:00:00.000Z"),
        },
        {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Unassigned API range job",
          status: JobStatus.NEW,
          createdById: owner.user.id,
          scheduledStartAt: new Date("2026-04-09T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-09T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-09T00:00:00.000Z"),
        },
      ],
    });

    const ownerRange = await request(app)
      .get("/api/jobs/schedule/range")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({
        rangeStart: "2026-04-06T00:00:00.000Z",
        rangeEnd: "2026-04-13T00:00:00.000Z",
      });

    expect(ownerRange.status).toBe(200);
    expect(ownerRange.body.data.totalJobs).toBe(4);
    expect(ownerRange.body.data.conflictCount).toBe(2);
    expect(ownerRange.body.data.lanes).toHaveLength(3);
    expect(
      ownerRange.body.data.lanes.find((lane: { key: string }) => lane.key === "unassigned")
        ?.jobs[0]?.title,
    ).toBe("Unassigned API range job");

    const staffRange = await request(app)
      .get("/api/jobs/schedule/range")
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .query({
        rangeStart: "2026-04-06T00:00:00.000Z",
        rangeEnd: "2026-04-13T00:00:00.000Z",
        assigneeId: otherStaffUser.id,
      });

    expect(staffRange.status).toBe(200);
    expect(staffRange.body.data.lanes).toHaveLength(1);
    expect(staffRange.body.data.lanes[0]?.userId).toBe(staffUser.id);
    expect(staffRange.body.data.lanes[0]?.jobs).toHaveLength(2);

    const reversedRange = await request(app)
      .get("/api/jobs/schedule/range")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({
        rangeStart: "2026-04-13T00:00:00.000Z",
        rangeEnd: "2026-04-06T00:00:00.000Z",
      });
    expect(reversedRange.status).toBe(400);

    const tooWideRange = await request(app)
      .get("/api/jobs/schedule/range")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({
        rangeStart: "2026-04-01T00:00:00.000Z",
        rangeEnd: "2026-05-14T00:00:00.000Z",
      });
    expect(tooWideRange.status).toBe(400);
  });

  it("rejects invalid assignment targets, cross-tenant customer usage, and status mutation through patch payload", async () => {
    const primary = await seedTenantUser({
      email: "owner@primary-job-api.test",
      displayName: "Primary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Primary Job API Tenant",
      tenantSlug: "primary-job-api-tenant",
    });
    const secondary = await seedTenantUser({
      email: "owner@secondary-job-api.test",
      displayName: "Secondary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Secondary Job API Tenant",
      tenantSlug: "secondary-job-api-tenant",
    });

    const primaryCustomer = await seedCustomer(
      primary.tenant.id,
      primary.user.id,
      "Primary Customer",
    );
    const otherCustomer = await seedCustomer(
      secondary.tenant.id,
      secondary.user.id,
      "Other Customer",
    );
    const secondaryMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_tenantId: {
          userId: secondary.user.id,
          tenantId: secondary.tenant.id,
        },
      },
    });

    const created = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${primary.accessToken}`)
      .send({
        customerId: primaryCustomer.id,
        title: "Primary Job",
      });
    expect(created.status).toBe(201);

    const crossTenantCreate = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${primary.accessToken}`)
      .send({
        customerId: otherCustomer.id,
        title: "Wrong Customer Job",
      });
    expect(crossTenantCreate.status).toBe(404);

    const crossTenantAssign = await request(app)
      .post(`/api/jobs/${created.body.data.id}/assign`)
      .set("Authorization", `Bearer ${primary.accessToken}`)
      .send({
        membershipId: secondaryMembership.id,
      });
    expect(crossTenantAssign.status).toBe(404);

    const illegalPatch = await request(app)
      .patch(`/api/jobs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${primary.accessToken}`)
      .send({
        customerId: primaryCustomer.id,
        title: "Primary Job",
        status: "COMPLETED",
      });
    expect(illegalPatch.status).toBe(400);

    const crossTenantDetail = await request(app)
      .get(`/api/jobs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${secondary.accessToken}`);
    expect(crossTenantDetail.status).toBe(404);

    const disabledStaffUser = await prisma.user.create({
      data: {
        email: "disabled@primary-job-api.test",
        passwordHash: await hashPassword("password123"),
        displayName: "Disabled Staff",
      },
    });
    const disabledMembership = await prisma.membership.create({
      data: {
        userId: disabledStaffUser.id,
        tenantId: primary.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.DISABLED,
      },
    });

    const invalidAssignment = await request(app)
      .post(`/api/jobs/${created.body.data.id}/assign`)
      .set("Authorization", `Bearer ${primary.accessToken}`)
      .send({
        membershipId: disabledMembership.id,
      });
    expect(invalidAssignment.status).toBe(409);
  });

  it("returns job history and enforces workflow transition visibility", async () => {
    const owner = await seedTenantUser({
      email: "owner@workflow-api.test",
      displayName: "Workflow Owner",
      role: MembershipRole.OWNER,
      tenantName: "Workflow API Tenant",
      tenantSlug: "workflow-api-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffUser, otherStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff@workflow-api.test",
          passwordHash,
          displayName: "Workflow Staff",
        },
      }),
      prisma.user.create({
        data: {
          email: "other-staff@workflow-api.test",
          passwordHash,
          displayName: "Other Workflow Staff",
        },
      }),
    ]);

    const [staffMembership] = await Promise.all([
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
          userId: otherStaffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    const staffSession = await login({
      email: staffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });
    const otherStaffSession = await login({
      email: otherStaffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });

    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Workflow Customer");
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Workflow Job",
        status: JobStatus.NEW,
        createdById: owner.user.id,
        assignedToId: staffUser.id,
      },
    });

    const cancelWithoutReason = await request(app)
      .post(`/api/jobs/${job.id}/status-transitions`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        toStatus: JobStatus.CANCELLED,
      });
    expect(cancelWithoutReason.status).toBe(400);

    const scheduled = await request(app)
      .post(`/api/jobs/${job.id}/status-transitions`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        toStatus: JobStatus.SCHEDULED,
      });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.job.status).toBe("SCHEDULED");
    expect(scheduled.body.data.allowedTransitions).toEqual(["IN_PROGRESS", "CANCELLED"]);

    const historyAfterSchedule = await request(app)
      .get(`/api/jobs/${job.id}/history`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(historyAfterSchedule.status).toBe(200);
    expect(historyAfterSchedule.body.data.history).toHaveLength(1);
    expect(historyAfterSchedule.body.data.history[0]?.toStatus).toBe("SCHEDULED");

    const ownerInProgress = await request(app)
      .post(`/api/jobs/${job.id}/status-transitions`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        toStatus: JobStatus.IN_PROGRESS,
      });
    expect(ownerInProgress.status).toBe(200);
    expect(ownerInProgress.body.data.job.status).toBe("IN_PROGRESS");
    expect(ownerInProgress.body.data.allowedTransitions).toEqual([
      "PENDING_REVIEW",
      "CANCELLED",
    ]);

    const hiddenStaffTransition = await request(app)
      .post(`/api/jobs/${job.id}/status-transitions`)
      .set("Authorization", `Bearer ${otherStaffSession.accessToken}`)
      .send({
        toStatus: JobStatus.PENDING_REVIEW,
        reason: "Should not be allowed",
      });
    expect(hiddenStaffTransition.status).toBe(403);

    const otherStaffSubmit = await request(app)
      .post(`/api/jobs/${job.id}/completion-review`)
      .set("Authorization", `Bearer ${otherStaffSession.accessToken}`)
      .send({
        completionNote: "I should not be able to submit this job.",
      });
    expect(otherStaffSubmit.status).toBe(404);

    const submitted = await request(app)
      .post(`/api/jobs/${job.id}/completion-review`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        completionNote: "Work completed successfully.",
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.job.status).toBe("PENDING_REVIEW");
    expect(submitted.body.data.review.status).toBe("PENDING");
    expect(submitted.body.data.allowedTransitions).toEqual([
      "COMPLETED",
      "IN_PROGRESS",
      "CANCELLED",
    ]);

    const duplicateSubmit = await request(app)
      .post(`/api/jobs/${job.id}/completion-review`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        completionNote: "Submitting again should not be allowed while pending review.",
      });
    expect(duplicateSubmit.status).toBe(409);

    const latestReview = await request(app)
      .get(`/api/jobs/${job.id}/completion-review`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(latestReview.status).toBe(200);
    expect(latestReview.body.data.completionNote).toBe("Work completed successfully.");

    const returned = await request(app)
      .post(`/api/jobs/${job.id}/completion-review/${submitted.body.data.review.id}/return`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reviewNote: "Please add clearer completion evidence.",
      });
    expect(returned.status).toBe(200);
    expect(returned.body.data.job.status).toBe("IN_PROGRESS");
    expect(returned.body.data.review.status).toBe("RETURNED");
    expect(returned.body.data.review.reviewNote).toBe(
      "Please add clearer completion evidence.",
    );

    const resubmitted = await request(app)
      .post(`/api/jobs/${job.id}/completion-review`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        completionNote: "Added clearer evidence and completed the repair.",
      });
    expect(resubmitted.status).toBe(201);
    expect(resubmitted.body.data.job.status).toBe("PENDING_REVIEW");

    const completed = await request(app)
      .post(`/api/jobs/${job.id}/completion-review/${resubmitted.body.data.review.id}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({});
    expect(completed.status).toBe(200);
    expect(completed.body.data.job.status).toBe("COMPLETED");
    expect(completed.body.data.review.status).toBe("APPROVED");
    expect(completed.body.data.allowedTransitions).toEqual([]);

    const cancelReviewJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Pending review cancel job",
        status: JobStatus.PENDING_REVIEW,
        createdById: owner.user.id,
        assignedToId: staffUser.id,
      },
    });
    const cancelPendingReview = await request(app)
      .post(`/api/jobs/${cancelReviewJob.id}/status-transitions`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        toStatus: JobStatus.CANCELLED,
        reason: "Customer withdrew after completion was submitted.",
      });
    expect(cancelPendingReview.status).toBe(200);
    expect(cancelPendingReview.body.data.job.status).toBe("CANCELLED");

    const historyAfterComplete = await request(app)
      .get(`/api/jobs/${job.id}/history`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`);
    expect(historyAfterComplete.status).toBe(200);
    expect(historyAfterComplete.body.data.history).toHaveLength(6);
    expect(historyAfterComplete.body.data.allowedTransitions).toEqual([]);

    const transitionAuditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        targetId: job.id,
        action: AuditAction.JOB_STATUS_TRANSITION,
      },
    });
    expect(transitionAuditLogs).toHaveLength(6);

    const completionAuditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        action: {
          in: [
            AuditAction.JOB_COMPLETION_SUBMITTED,
            AuditAction.JOB_COMPLETION_RETURNED,
            AuditAction.JOB_COMPLETION_APPROVED,
          ],
        },
      },
    });
    expect(completionAuditLogs).toHaveLength(4);
  });
});
