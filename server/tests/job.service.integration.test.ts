import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import type { AuthContext } from "../src/types/auth";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  assignJob,
  createJob,
  getScheduleDay,
  getScheduleRange,
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
      serviceAddress: "18 Collins Street, Melbourne VIC 3000",
      description: "Kitchen tap leaking.",
      scheduledStartAt: "2026-03-30T02:00:00.000Z",
      scheduledEndAt: "2026-03-30T03:00:00.000Z",
    });

    await prisma.job.create({
      data: {
        tenantId: auth.tenantId,
        customerId: customerB.id,
        title: "Blocked drain",
        serviceAddress: "42 Queensbridge Street, Southbank VIC 3006",
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
        serviceAddress: "7 Bourke Street, Docklands VIC 3008",
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
      scheduledStartAt: "2026-04-01T03:00:00.000Z",
      scheduledEndAt: "2026-04-01T04:00:00.000Z",
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

  it("blocks archived customers for new job linkage while preserving existing history", async () => {
    const { auth, user } = await seedTenantUser({
      email: "manager@job-archived-customer.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Archived Customer Job Tenant",
      tenantSlug: "archived-customer-job-tenant",
    });

    const activeCustomer = await seedCustomer(auth, "Active Customer");
    const archivedCustomer = await prisma.customer.update({
      where: {
        id: (await seedCustomer(auth, "Archived Customer")).id,
      },
      data: {
        archivedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    await expect(
      createJob(auth, {
        customerId: archivedCustomer.id,
        title: "New archived customer job",
        serviceAddress: "63 Rathdowne Street, Carlton VIC 3053",
        description: "",
        scheduledStartAt: undefined,
        scheduledEndAt: undefined,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    const activeJob = await createJob(auth, {
      customerId: activeCustomer.id,
      title: "Active customer job",
      serviceAddress: "25 Gertrude Street, Fitzroy VIC 3065",
      description: "",
      scheduledStartAt: undefined,
      scheduledEndAt: undefined,
    });

    await expect(
      updateJob(auth, activeJob.id, {
        customerId: archivedCustomer.id,
        title: "Move to archived customer",
        description: "",
        scheduledStartAt: undefined,
        scheduledEndAt: undefined,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    const historicalJob = await prisma.job.create({
      data: {
        tenantId: auth.tenantId,
        customerId: archivedCustomer.id,
        title: "Historical archived customer job",
        serviceAddress: "89 Smith Street, Collingwood VIC 3066",
        status: JobStatus.COMPLETED,
        createdById: user.id,
      },
    });

    await expect(
      updateJob(auth, historicalJob.id, {
        customerId: archivedCustomer.id,
        title: "Historical archived customer job updated",
        description: "",
        scheduledStartAt: undefined,
        scheduledEndAt: undefined,
      }),
    ).resolves.toMatchObject({
      id: historicalJob.id,
      title: "Historical archived customer job updated",
      customer: {
        id: archivedCustomer.id,
      },
    });
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
      serviceAddress: "31 Swan Street, Richmond VIC 3121",
      description: "",
      scheduledStartAt: "",
      scheduledEndAt: "",
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
        serviceAddress: "54 Toorak Road, South Yarra VIC 3141",
        description: "",
        scheduledStartAt: "",
        scheduledEndAt: "",
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
        serviceAddress: "16 Greville Street, Prahran VIC 3181",
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

  it("loads schedule ranges with lanes, unassigned work, and conflicts", async () => {
    const manager = await seedTenantUser({
      email: "manager@schedule-range.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Schedule Range Tenant",
      tenantSlug: "schedule-range-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffA, staffB] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff-a@schedule-range.test",
          passwordHash,
          displayName: "Staff A",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-b@schedule-range.test",
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

    const customer = await seedCustomer(manager.auth, "Range Customer");
    await prisma.job.createMany({
      data: [
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "First overlap",
          serviceAddress: "72 Acland Street, St Kilda VIC 3182",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffA.id,
          scheduledStartAt: new Date("2026-04-07T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-07T02:00:00.000Z"),
          scheduledAt: new Date("2026-04-07T00:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Second overlap",
          serviceAddress: "27 Bay Street, Port Melbourne VIC 3207",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffA.id,
          scheduledStartAt: new Date("2026-04-07T01:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-07T03:00:00.000Z"),
          scheduledAt: new Date("2026-04-07T01:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Spans range start",
          serviceAddress: "44 Bridport Street, Albert Park VIC 3206",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffB.id,
          scheduledStartAt: new Date("2026-04-05T23:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-06T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-05T23:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Unassigned range job",
          serviceAddress: "93 Sydney Road, Brunswick VIC 3056",
          status: JobStatus.NEW,
          createdById: manager.user.id,
          scheduledStartAt: new Date("2026-04-08T04:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-08T05:00:00.000Z"),
          scheduledAt: new Date("2026-04-08T04:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Outside range",
          serviceAddress: "38 Bell Street, Coburg VIC 3058",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffB.id,
          scheduledStartAt: new Date("2026-04-15T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-15T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-15T00:00:00.000Z"),
        },
      ],
    });

    const result = await getScheduleRange(manager.auth, {
      rangeStart: "2026-04-06T00:00:00.000Z",
      rangeEnd: "2026-04-13T00:00:00.000Z",
    });

    expect(result.totalJobs).toBe(4);
    expect(result.conflictCount).toBe(2);
    expect(result.lanes).toHaveLength(3);
    expect(result.lanes.find((lane) => lane.userId === staffA.id)?.jobs).toHaveLength(2);
    expect(result.lanes.find((lane) => lane.userId === staffB.id)?.jobs[0]?.title).toBe("Spans range start");
    expect(result.lanes.find((lane) => lane.key === "unassigned")?.jobs[0]?.title).toBe("Unassigned range job");
  });

  it("limits staff schedule range queries to their own assigned jobs", async () => {
    const manager = await seedTenantUser({
      email: "manager@staff-schedule-range.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Staff Schedule Range Tenant",
      tenantSlug: "staff-schedule-range-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffA, staffB] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff-a@staff-schedule-range.test",
          passwordHash,
          displayName: "Staff A",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-b@staff-schedule-range.test",
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

    const customer = await seedCustomer(manager.auth, "Staff Range Customer");
    await prisma.job.createMany({
      data: [
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Staff A range job",
          serviceAddress: "12 High Street, Northcote VIC 3070",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffA.id,
          scheduledStartAt: new Date("2026-04-09T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-09T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-09T00:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Staff B range job",
          serviceAddress: "64 Normanby Avenue, Thornbury VIC 3071",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffB.id,
          scheduledStartAt: new Date("2026-04-09T02:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-09T03:00:00.000Z"),
          scheduledAt: new Date("2026-04-09T02:00:00.000Z"),
        },
      ],
    });

    const result = await getScheduleRange(
      {
        userId: staffA.id,
        sessionId: `${staffA.id}-session`,
        tenantId: manager.tenant.id,
        role: MembershipRole.STAFF,
      },
      {
        rangeStart: "2026-04-06T00:00:00.000Z",
        rangeEnd: "2026-04-13T00:00:00.000Z",
        assigneeId: staffB.id,
      },
    );

    expect(result.lanes).toHaveLength(1);
    expect(result.lanes[0]?.userId).toBe(staffA.id);
    expect(result.lanes[0]?.jobs).toHaveLength(1);
    expect(result.lanes[0]?.jobs[0]?.title).toBe("Staff A range job");
  });

  it("rejects invalid schedule ranges", async () => {
    const manager = await seedTenantUser({
      email: "manager@invalid-schedule-range.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Invalid Schedule Range Tenant",
      tenantSlug: "invalid-schedule-range-tenant",
    });

    await expect(
      getScheduleRange(manager.auth, {
        rangeStart: "2026-04-13T00:00:00.000Z",
        rangeEnd: "2026-04-06T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    await expect(
      getScheduleRange(manager.auth, {
        rangeStart: "2026-04-01T00:00:00.000Z",
        rangeEnd: "2026-05-14T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("limits staff schedule day queries to their own assigned jobs", async () => {
    const manager = await seedTenantUser({
      email: "manager@schedule-day.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Schedule Day Tenant",
      tenantSlug: "schedule-day-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffA, staffB] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff-a@schedule-day.test",
          passwordHash,
          displayName: "Staff A",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-b@schedule-day.test",
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

    const customer = await seedCustomer(manager.auth, "Schedule Customer");
    await prisma.job.createMany({
      data: [
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Staff A job",
          serviceAddress: "21 Plenty Road, Preston VIC 3072",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffA.id,
          scheduledStartAt: new Date("2026-04-04T00:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-04T01:00:00.000Z"),
          scheduledAt: new Date("2026-04-04T00:00:00.000Z"),
        },
        {
          tenantId: manager.tenant.id,
          customerId: customer.id,
          title: "Staff B job",
          serviceAddress: "84 Buckley Street, Essendon VIC 3040",
          status: JobStatus.SCHEDULED,
          createdById: manager.user.id,
          assignedToId: staffB.id,
          scheduledStartAt: new Date("2026-04-04T02:00:00.000Z"),
          scheduledEndAt: new Date("2026-04-04T03:00:00.000Z"),
          scheduledAt: new Date("2026-04-04T02:00:00.000Z"),
        },
      ],
    });

    const result = await getScheduleDay(
      {
        userId: staffA.id,
        sessionId: `${staffA.id}-session`,
        tenantId: manager.tenant.id,
        role: MembershipRole.STAFF,
      },
      {
        date: "2026-04-04",
        assigneeId: staffB.id,
        timezoneOffsetMinutes: 0,
      },
    );

    expect(result.lanes).toHaveLength(1);
    expect(result.lanes[0]?.userId).toBe(staffA.id);
    expect(result.lanes[0]?.jobs).toHaveLength(1);
    expect(result.lanes[0]?.jobs[0]?.title).toBe("Staff A job");
  });
});
