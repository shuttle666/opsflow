import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  JobStatus,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
  TenantStatus,
} from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://opsflow:opsflow@localhost:5432/opsflow",
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const ids = {
  tenant: "10000000-0000-4000-8000-000000000001",
  owner: "20000000-0000-4000-8000-000000000001",
  manager: "20000000-0000-4000-8000-000000000002",
  staff: "20000000-0000-4000-8000-000000000003",
  customers: [
    "30000000-0000-4000-8000-000000000001",
    "30000000-0000-4000-8000-000000000002",
    "30000000-0000-4000-8000-000000000003",
    "30000000-0000-4000-8000-000000000004",
    "30000000-0000-4000-8000-000000000005",
    "30000000-0000-4000-8000-000000000006",
    "30000000-0000-4000-8000-000000000007",
    "30000000-0000-4000-8000-000000000008",
  ],
  jobs: [
    "40000000-0000-4000-8000-000000000001",
    "40000000-0000-4000-8000-000000000002",
    "40000000-0000-4000-8000-000000000003",
    "40000000-0000-4000-8000-000000000004",
    "40000000-0000-4000-8000-000000000005",
    "40000000-0000-4000-8000-000000000006",
  ],
};

async function main() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.tenantInvitation.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.jobStatusHistory.deleteMany(),
    prisma.job.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.tenant.create({
    data: {
      id: ids.tenant,
      name: "Acme Home Services",
      slug: "acme-home-services",
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        id: ids.owner,
        email: "owner@acme.example",
        passwordHash: bcrypt.hashSync("owner-password-123", 10),
        displayName: "Avery Owner",
      },
      {
        id: ids.manager,
        email: "manager@acme.example",
        passwordHash: bcrypt.hashSync("manager-password-123", 10),
        displayName: "Morgan Manager",
      },
      {
        id: ids.staff,
        email: "staff@acme.example",
        passwordHash: bcrypt.hashSync("staff-password-123", 10),
        displayName: "Sam Staff",
      },
    ],
  });

  await prisma.membership.createMany({
    data: [
      {
        userId: ids.owner,
        tenantId: ids.tenant,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      {
        userId: ids.manager,
        tenantId: ids.tenant,
        role: MembershipRole.MANAGER,
        status: MembershipStatus.ACTIVE,
      },
      {
        userId: ids.staff,
        tenantId: ids.tenant,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    ],
  });

  await prisma.customer.createMany({
    data: [
      {
        id: ids.customers[0],
        tenantId: ids.tenant,
        name: "Noah Thompson",
        phone: "0412 000 001",
        email: "noah.t@example.com",
        address: "12 Glenview Rd, Adelaide",
        createdById: ids.manager,
      },
      {
        id: ids.customers[1],
        tenantId: ids.tenant,
        name: "Olivia Davis",
        phone: "0412 000 002",
        email: "olivia.d@example.com",
        address: "44 East Parkway, Adelaide",
        createdById: ids.manager,
      },
      {
        id: ids.customers[2],
        tenantId: ids.tenant,
        name: "Ethan Wilson",
        phone: "0412 000 003",
        email: "ethan.w@example.com",
        address: "9 Garden St, Norwood",
        createdById: ids.owner,
      },
      {
        id: ids.customers[3],
        tenantId: ids.tenant,
        name: "Sophia Brown",
        phone: "0412 000 004",
        email: "sophia.b@example.com",
        address: "88 River Ave, Prospect",
        createdById: ids.owner,
      },
      {
        id: ids.customers[4],
        tenantId: ids.tenant,
        name: "Liam Martin",
        phone: "0412 000 005",
        email: "liam.m@example.com",
        address: "3 Ashford St, Mile End",
        createdById: ids.manager,
      },
      {
        id: ids.customers[5],
        tenantId: ids.tenant,
        name: "Mia Clark",
        phone: "0412 000 006",
        email: "mia.c@example.com",
        address: "55 Franklin St, Adelaide",
        createdById: ids.manager,
      },
      {
        id: ids.customers[6],
        tenantId: ids.tenant,
        name: "James Lee",
        phone: "0412 000 007",
        email: "james.l@example.com",
        address: "72 Main North Rd, Blair Athol",
        createdById: ids.owner,
      },
      {
        id: ids.customers[7],
        tenantId: ids.tenant,
        name: "Charlotte King",
        phone: "0412 000 008",
        email: "charlotte.k@example.com",
        address: "17 Hazel Rd, Unley",
        createdById: ids.owner,
      },
    ],
  });

  await prisma.job.createMany({
    data: [
      {
        id: ids.jobs[0],
        tenantId: ids.tenant,
        customerId: ids.customers[0],
        title: "Leaking kitchen tap",
        description: "Constant drip from mixer tap.",
        status: JobStatus.NEW,
        createdById: ids.manager,
      },
      {
        id: ids.jobs[1],
        tenantId: ids.tenant,
        customerId: ids.customers[1],
        title: "Blocked bathroom drain",
        description: "Water drains very slowly.",
        status: JobStatus.SCHEDULED,
        createdById: ids.manager,
        assignedToId: ids.staff,
        scheduledAt: new Date("2026-03-20T02:00:00.000Z"),
      },
      {
        id: ids.jobs[2],
        tenantId: ids.tenant,
        customerId: ids.customers[2],
        title: "Hot water system check",
        description: "No hot water in the morning.",
        status: JobStatus.IN_PROGRESS,
        createdById: ids.owner,
        assignedToId: ids.staff,
        scheduledAt: new Date("2026-03-19T22:00:00.000Z"),
      },
      {
        id: ids.jobs[3],
        tenantId: ids.tenant,
        customerId: ids.customers[3],
        title: "Aircon maintenance",
        description: "Routine pre-summer service.",
        status: JobStatus.COMPLETED,
        createdById: ids.owner,
        assignedToId: ids.staff,
        scheduledAt: new Date("2026-03-17T23:00:00.000Z"),
      },
      {
        id: ids.jobs[4],
        tenantId: ids.tenant,
        customerId: ids.customers[4],
        title: "Urgent pipe burst",
        description: "Pipe burst in laundry room.",
        status: JobStatus.CANCELLED,
        createdById: ids.manager,
      },
      {
        id: ids.jobs[5],
        tenantId: ids.tenant,
        customerId: ids.customers[5],
        title: "Door hinge replacement",
        description: "Front door hinge is damaged.",
        status: JobStatus.COMPLETED,
        createdById: ids.manager,
        assignedToId: ids.staff,
        scheduledAt: new Date("2026-03-15T23:00:00.000Z"),
      },
    ],
  });

  await prisma.jobStatusHistory.createMany({
    data: [
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[1],
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.SCHEDULED,
        changedById: ids.manager,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[2],
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.SCHEDULED,
        changedById: ids.manager,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[2],
        fromStatus: JobStatus.SCHEDULED,
        toStatus: JobStatus.IN_PROGRESS,
        changedById: ids.staff,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[3],
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.SCHEDULED,
        changedById: ids.owner,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[3],
        fromStatus: JobStatus.SCHEDULED,
        toStatus: JobStatus.IN_PROGRESS,
        changedById: ids.staff,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[3],
        fromStatus: JobStatus.IN_PROGRESS,
        toStatus: JobStatus.COMPLETED,
        changedById: ids.staff,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[4],
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.CANCELLED,
        changedById: ids.manager,
        reason: "Customer resolved issue independently.",
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[5],
        fromStatus: JobStatus.NEW,
        toStatus: JobStatus.SCHEDULED,
        changedById: ids.manager,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[5],
        fromStatus: JobStatus.SCHEDULED,
        toStatus: JobStatus.IN_PROGRESS,
        changedById: ids.staff,
      },
      {
        tenantId: ids.tenant,
        jobId: ids.jobs[5],
        fromStatus: JobStatus.IN_PROGRESS,
        toStatus: JobStatus.COMPLETED,
        changedById: ids.staff,
      },
    ],
  });

  console.log("Seed complete: acme-home-services tenant demo data inserted.");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
