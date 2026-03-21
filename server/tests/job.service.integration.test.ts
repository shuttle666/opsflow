import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import type { AuthContext } from "../src/types/auth";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  assignJob,
  createJob,
  getJobDetail,
  listJobs,
  listMyJobs,
  unassignJob,
  updateJob,
} from "../src/modules/job/job.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("job service integration", () => {
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

    return {
      tenant,
      user,
      auth: {
        userId: user.id,
        sessionId: `${user.id}-session`,
        tenantId: tenant.id,
        role: input.role,
      } satisfies AuthContext,
    };
  }

  async function seedCustomer(auth: AuthContext, name = "Job Customer") {
    return prisma.customer.create({
      data: {
        tenantId: auth.tenantId,
        name,
        createdById: auth.userId,
      },
    });
  }

  it("creates jobs with default NEW status and lists them with filters", async () => {
    const { auth } = await seedTenantUser({
      email: "owner@job-service.test",
      displayName: "Owner",
      role: MembershipRole.OWNER,
      tenantName: "Job Tenant",
      tenantSlug: "job-tenant",
    });

    const customerA = await seedCustomer(auth, "Noah Thompson");
    const customerB = await seedCustomer(auth, "Olivia Davis");

    await createJob(auth, {
      customerId: customerA.id,
      title: "Leaking tap",
      description: "Kitchen tap leaking.",
      scheduledAt: "2026-03-30T02:00:00.000Z",
    });

    await prisma.job.create({
      data: {
        tenantId: auth.tenantId,
        customerId: customerB.id,
        title: "Blocked drain",
        description: "Slow bathroom drain.",
        status: JobStatus.SCHEDULED,
        createdById: auth.userId,
      },
    });

    const listed = await listJobs(auth, {
      q: "Noah",
      status: undefined,
      customerId: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
      page: 1,
      pageSize: 10,
      sort: "createdAt_desc",
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.status).toBe(JobStatus.NEW);
    expect(listed.items[0]?.customer.name).toBe("Noah Thompson");

    const filtered = await listJobs(auth, {
      q: undefined,
      status: JobStatus.SCHEDULED,
      customerId: customerB.id,
      scheduledFrom: undefined,
      scheduledTo: undefined,
      page: 1,
      pageSize: 10,
      sort: "createdAt_desc",
    });

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.title).toBe("Blocked drain");
  });

  it("loads job detail, updates allowed fields, and manages assignment", async () => {
    const { auth, user } = await seedTenantUser({
      email: "manager@job-detail.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Detail Job Tenant",
      tenantSlug: "detail-job-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const staff = await prisma.user.create({
      data: {
        email: "staff@job-detail.test",
        passwordHash,
        displayName: "Sam Staff",
      },
    });
    await prisma.membership.create({
      data: {
        userId: staff.id,
        tenantId: auth.tenantId,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    const customerA = await seedCustomer(auth, "Mia Clark");
    const customerB = await seedCustomer(auth, "James Lee");

    const job = await prisma.job.create({
      data: {
        tenantId: auth.tenantId,
        customerId: customerA.id,
        title: "Aircon check",
        description: "Check airflow",
        status: JobStatus.NEW,
        createdById: user.id,
        assignedToId: staff.id,
      },
    });

    const detail = await getJobDetail(auth, job.id);

    expect(detail.customer.name).toBe("Mia Clark");
    expect(detail.createdBy.email).toBe("manager@job-detail.test");
    expect(detail.assignedTo?.displayName).toBe("Sam Staff");

    const updated = await updateJob(auth, job.id, {
      customerId: customerB.id,
      title: "Aircon service visit",
      description: "",
      scheduledAt: "2026-04-01T03:00:00.000Z",
    });

    expect(updated.title).toBe("Aircon service visit");
    expect(updated.customer.id).toBe(customerB.id);
    expect(updated.status).toBe(JobStatus.NEW);

    const staffMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_tenantId: {
          userId: staff.id,
          tenantId: auth.tenantId,
        },
      },
    });

    const assigned = await assignJob(auth, job.id, {
      membershipId: staffMembership.id,
    });
    expect(assigned.assignedTo?.email).toBe("staff@job-detail.test");

    const myJobs = await listMyJobs(
      {
        userId: staff.id,
        sessionId: `${staff.id}-session`,
        tenantId: auth.tenantId,
        role: MembershipRole.STAFF,
      },
      {
        q: undefined,
        status: undefined,
        customerId: undefined,
        scheduledFrom: undefined,
        scheduledTo: undefined,
        page: 1,
        pageSize: 10,
        sort: "createdAt_desc",
      },
    );
    expect(myJobs.items).toHaveLength(1);
    expect(myJobs.items[0]?.id).toBe(job.id);

    const unassigned = await unassignJob(auth, job.id);
    expect(unassigned.assignedTo).toBeUndefined();
  });

  it("blocks cross-tenant job and customer access", async () => {
    const primary = await seedTenantUser({
      email: "owner@primary-job.test",
      displayName: "Primary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Primary Job Tenant",
      tenantSlug: "primary-job-tenant",
    });
    const secondary = await seedTenantUser({
      email: "owner@secondary-job.test",
      displayName: "Secondary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Secondary Job Tenant",
      tenantSlug: "secondary-job-tenant",
    });

    const primaryCustomer = await seedCustomer(primary.auth, "Primary Customer");
    const secondaryCustomer = await seedCustomer(secondary.auth, "Secondary Customer");

    const job = await createJob(primary.auth, {
      customerId: primaryCustomer.id,
      title: "Primary Job",
      description: "",
      scheduledAt: "",
    });

    await expect(
      getJobDetail(secondary.auth, job.id),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    await expect(
      createJob(primary.auth, {
        customerId: secondaryCustomer.id,
        title: "Wrong Customer",
        description: "",
        scheduledAt: "",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("prevents staff from reading jobs not assigned to them", async () => {
    const manager = await seedTenantUser({
      email: "manager@staff-visibility.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Staff Visibility Tenant",
      tenantSlug: "staff-visibility-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffA, staffB] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff-a@staff-visibility.test",
          passwordHash,
          displayName: "Staff A",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-b@staff-visibility.test",
          passwordHash,
          displayName: "Staff B",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: staffA.id,
          tenantId: manager.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: staffB.id,
          tenantId: manager.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const customer = await seedCustomer(manager.auth, "Visibility Customer");
    const job = await prisma.job.create({
      data: {
        tenantId: manager.tenant.id,
        customerId: customer.id,
        title: "Assigned Job",
        status: JobStatus.NEW,
        createdById: manager.user.id,
        assignedToId: staffA.id,
      },
    });

    await expect(
      getJobDetail(
        {
          userId: staffB.id,
          sessionId: `${staffB.id}-session`,
          tenantId: manager.tenant.id,
          role: MembershipRole.STAFF,
        },
        job.id,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
