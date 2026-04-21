import bcrypt from "bcryptjs";
import {
  AuditAction,
  JobCompletionAiStatus,
  JobCompletionReviewStatus,
  JobStatus,
  MembershipRole,
  MembershipStatus,
  type Prisma,
  TenantStatus,
} from "@prisma/client";

export const demoTenant = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Acme Home Services",
  slug: "acme-home-services",
} as const;

export const demoSeedConfirmValue = "reset-production-demo";

const ownerId = demoId("20000000", 1);
const managerId = demoId("20000000", 2);
const primaryStaffId = demoId("20000000", 3);
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;

const allStaffProfiles = [
  {
    id: primaryStaffId,
    email: "staff@acme.example",
    displayName: "Sam Staff",
  },
  {
    id: demoId("20000000", 4),
    email: "staff02@acme.example",
    displayName: "Riley Chen",
  },
  {
    id: demoId("20000000", 5),
    email: "staff03@acme.example",
    displayName: "Taylor Singh",
  },
  {
    id: demoId("20000000", 6),
    email: "staff04@acme.example",
    displayName: "Jordan Patel",
  },
  {
    id: demoId("20000000", 7),
    email: "staff05@acme.example",
    displayName: "Casey Martin",
  },
  {
    id: demoId("20000000", 8),
    email: "staff06@acme.example",
    displayName: "Alex Nguyen",
  },
  {
    id: demoId("20000000", 9),
    email: "staff07@acme.example",
    displayName: "Jamie Wilson",
  },
  {
    id: demoId("20000000", 10),
    email: "staff08@acme.example",
    displayName: "Morgan Brooks",
  },
  {
    id: demoId("20000000", 11),
    email: "staff09@acme.example",
    displayName: "Quinn Roberts",
  },
  {
    id: demoId("20000000", 12),
    email: "staff10@acme.example",
    displayName: "Harper Lee",
  },
] as const;

const customerFirstNames = [
  "Noah",
  "Olivia",
  "Ethan",
  "Sophia",
  "Liam",
  "Mia",
  "James",
  "Charlotte",
  "Lucas",
  "Amelia",
  "Henry",
  "Isla",
  "Leo",
  "Ava",
  "Jack",
  "Grace",
  "Archie",
  "Ella",
  "Hudson",
  "Ruby",
];

const customerLastNames = [
  "Thompson",
  "Davis",
  "Wilson",
  "Brown",
  "Martin",
  "Clark",
  "Lee",
  "King",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "Wright",
  "Scott",
  "Green",
  "Baker",
  "Adams",
  "Nelson",
  "Turner",
  "Campbell",
];

const suburbs = [
  "Adelaide",
  "North Adelaide",
  "Norwood",
  "Unley",
  "Prospect",
  "Glenelg",
  "Mile End",
  "Kensington",
  "Burnside",
  "Goodwood",
  "Henley Beach",
  "Semaphore",
  "Mawson Lakes",
  "Modbury",
  "Brighton",
  "Stirling",
  "Port Adelaide",
  "Blackwood",
  "Magill",
  "Payneham",
];

const streetNames = [
  "Glenview Rd",
  "East Parkway",
  "Garden St",
  "River Ave",
  "Ashford St",
  "Franklin St",
  "Main North Rd",
  "Hazel Rd",
  "King William Rd",
  "The Parade",
  "Jetty Rd",
  "Prospect Rd",
  "Greenhill Rd",
  "Fullarton Rd",
  "Military Rd",
  "Port Rd",
];

const jobTemplates = [
  {
    title: "Leaking kitchen tap",
    description: "Mixer tap has a constant drip and water is pooling around the sink.",
  },
  {
    title: "Blocked bathroom drain",
    description: "Shower drain is backing up and needs clearing before the next tenancy inspection.",
  },
  {
    title: "Hot water system check",
    description: "Customer reports intermittent hot water and low pressure in the morning.",
  },
  {
    title: "Aircon maintenance",
    description: "Routine split-system service with filter clean and performance check.",
  },
  {
    title: "Power point repair",
    description: "Double power point is loose and intermittently losing power.",
  },
  {
    title: "Front door lock replacement",
    description: "Deadlock is sticking and customer requested a like-for-like replacement.",
  },
  {
    title: "Ceiling fan installation",
    description: "Install customer-supplied ceiling fan and test wall control.",
  },
  {
    title: "Smoke alarm inspection",
    description: "Annual smoke alarm compliance check and battery replacement if required.",
  },
  {
    title: "Fence gate adjustment",
    description: "Side gate has dropped and no longer latches cleanly.",
  },
  {
    title: "Dishwasher leak investigation",
    description: "Water appears under dishwasher after longer cycles.",
  },
  {
    title: "Garden tap replacement",
    description: "Outdoor tap is seized and leaking at the spindle.",
  },
  {
    title: "Garage light fault",
    description: "Fluorescent garage light fails to start reliably.",
  },
];

const cancellationReasons = [
  "Customer resolved the issue independently.",
  "Customer requested cancellation after receiving a revised quote.",
  "Duplicate job created by mistake.",
  "Access was not available and customer asked to rebook later.",
  "Work is no longer required by the property manager.",
];

const returnReasons = [
  "Please add clearer completion photos before approval.",
  "Customer reported the issue is still present after testing.",
  "Invoice details need to be corrected before this can be approved.",
  "Please confirm the replacement part model in the completion note.",
];

type BuiltUser = Prisma.UserCreateManyInput & {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
};

type BuiltCustomer = Prisma.CustomerCreateManyInput & {
  id: string;
  name: string;
  archivedAt?: Date | null;
};

type BuiltJob = Prisma.JobCreateManyInput & {
  id: string;
  assignedToId?: string | null;
  scheduledStartAt?: Date | null;
  status: JobStatus;
  title: string;
};

export type DemoSeedProfile = {
  name: string;
  customerCount: number;
  archivedCustomerCount: number;
  staffCount: number;
  statusCounts: Record<JobStatus, number>;
  returnedInProgressReviews: number;
};

export type DemoSeedData = {
  profile: DemoSeedProfile;
  baseDate: Date;
  tenantId: string;
  tenant: Prisma.TenantCreateInput;
  users: BuiltUser[];
  memberships: Prisma.MembershipCreateManyInput[];
  customers: BuiltCustomer[];
  jobs: BuiltJob[];
  statusHistory: Prisma.JobStatusHistoryCreateManyInput[];
  completionReviews: Prisma.JobCompletionReviewCreateManyInput[];
  auditLogs: Prisma.AuditLogCreateManyInput[];
  staffProfiles: Array<(typeof allStaffProfiles)[number]>;
};

export const demoSeedProfiles = {
  developmentLarge: {
    name: "development-large",
    customerCount: 80,
    archivedCustomerCount: 12,
    staffCount: 10,
    returnedInProgressReviews: 8,
    statusCounts: {
      [JobStatus.NEW]: 40,
      [JobStatus.SCHEDULED]: 70,
      [JobStatus.IN_PROGRESS]: 35,
      [JobStatus.PENDING_REVIEW]: 25,
      [JobStatus.COMPLETED]: 55,
      [JobStatus.CANCELLED]: 25,
    },
  },
  productionSmall: {
    name: "production-small",
    customerCount: 10,
    archivedCustomerCount: 2,
    staffCount: 4,
    returnedInProgressReviews: 1,
    statusCounts: {
      [JobStatus.NEW]: 3,
      [JobStatus.SCHEDULED]: 5,
      [JobStatus.IN_PROGRESS]: 3,
      [JobStatus.PENDING_REVIEW]: 3,
      [JobStatus.COMPLETED]: 4,
      [JobStatus.CANCELLED]: 2,
    },
  },
} satisfies Record<string, DemoSeedProfile>;

export function assertSafeDevelopmentDatabaseUrl(value: string) {
  const allowOverride = process.env.ALLOW_NON_DEV_SEED === "1";

  if (process.env.NODE_ENV === "production" && !allowOverride) {
    throw new Error("Refusing to seed while NODE_ENV=production. Set ALLOW_NON_DEV_SEED=1 to override.");
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL. Refusing to run destructive seed.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "postgres", "opsflow-postgres"]);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const isDefaultDevDatabase =
    parsed.protocol.startsWith("postgres") &&
    allowedHosts.has(parsed.hostname) &&
    parsed.username === "opsflow" &&
    databaseName === "opsflow";

  if (!allowOverride && !isDefaultDevDatabase) {
    throw new Error(
      "Refusing to reset a non-default database. Set ALLOW_NON_DEV_SEED=1 only for a known safe dev database.",
    );
  }
}

export function assertProductionDemoSeedConfirmation() {
  if (process.env.DEMO_SEED_CONFIRM !== demoSeedConfirmValue) {
    throw new Error(
      `Refusing to reset production demo data. Set DEMO_SEED_CONFIRM=${demoSeedConfirmValue}.`,
    );
  }
}

export function buildDemoSeedData(
  profile: DemoSeedProfile,
  options: {
    baseDate?: Date;
    tenantId?: string;
  } = {},
): DemoSeedData {
  const baseDate = options.baseDate ?? resolveBaseDate();
  const tenantId = options.tenantId ?? demoTenant.id;
  const staffProfiles = allStaffProfiles.slice(0, profile.staffCount);
  const tenant: Prisma.TenantCreateInput = {
    id: tenantId,
    name: demoTenant.name,
    slug: demoTenant.slug,
    status: TenantStatus.ACTIVE,
    deletedAt: null,
  };
  const { users, memberships } = buildUsers(staffProfiles, tenantId);
  const customers = buildCustomers(profile, baseDate, tenantId);
  const { jobs, statusHistory, completionReviews, auditLogs } = buildJobData({
    baseDate,
    customers,
    profile,
    staffProfiles,
    tenantId,
  });

  return {
    profile,
    baseDate,
    tenantId,
    tenant,
    users,
    memberships,
    customers,
    jobs,
    statusHistory,
    completionReviews,
    auditLogs,
    staffProfiles,
  };
}

export function resolveBaseDate() {
  const override = process.env.DEMO_SEED_BASE_DATE?.trim();

  if (override) {
    return parseBaseDateOverride(override);
  }

  return startOfLocalDay(new Date());
}

export function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function printDemoSeedSummary(data: DemoSeedData) {
  const activeCustomers = data.customers.filter((customer) => !customer.archivedAt).length;
  const archivedCustomers = data.customers.length - activeCustomers;

  console.log(
    [
      `Profile: ${data.profile.name}`,
      `Base date: ${formatLocalDate(data.baseDate)} (${data.baseDate.toISOString()})`,
      `Users: ${data.users.length}`,
      `Staff: ${data.staffProfiles.length}`,
      `Customers: ${data.customers.length} (${activeCustomers} active, ${archivedCustomers} archived)`,
      `Jobs: ${data.jobs.length}`,
      `Status history entries: ${data.statusHistory.length}`,
      `Completion reviews: ${data.completionReviews.length}`,
      `Audit logs: ${data.auditLogs.length}`,
    ].join("\n"),
  );
}

export function getExpectedDemoUserIdentityByEmail(data: DemoSeedData) {
  return new Map(data.users.map((user) => [user.email, user]));
}

export function getExpectedDemoUserIdentityById(data: DemoSeedData) {
  return new Map(data.users.map((user) => [user.id, user]));
}

export function remapDemoSeedUserIds(data: DemoSeedData, idReplacements: Map<string, string>) {
  if (idReplacements.size === 0) {
    return data;
  }

  function replaceUserId(value: string | null | undefined) {
    return value ? (idReplacements.get(value) ?? value) : value;
  }

  for (const user of data.users) {
    user.id = replaceUserId(user.id) ?? user.id;
  }

  for (const membership of data.memberships) {
    membership.userId = replaceUserId(membership.userId) ?? membership.userId;
  }

  for (const customer of data.customers) {
    customer.createdById = replaceUserId(customer.createdById) ?? customer.createdById;
  }

  for (const job of data.jobs) {
    job.createdById = replaceUserId(job.createdById) ?? job.createdById;
    job.assignedToId = replaceUserId(job.assignedToId) ?? job.assignedToId;
  }

  for (const history of data.statusHistory) {
    history.changedById = replaceUserId(history.changedById) ?? history.changedById;
  }

  for (const review of data.completionReviews) {
    review.submittedById = replaceUserId(review.submittedById) ?? review.submittedById;
    review.reviewedById = replaceUserId(review.reviewedById) ?? review.reviewedById;
  }

  for (const auditLog of data.auditLogs) {
    auditLog.userId = replaceUserId(auditLog.userId) ?? auditLog.userId;
    auditLog.metadata = replaceAssigneeIdInMetadata(auditLog.metadata, idReplacements);
  }

  return data;
}

function parseBaseDateOverride(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("DEMO_SEED_BASE_DATE must be a valid date, for example 2026-04-21.");
  }

  return startOfLocalDay(parsed);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function demoId(prefix: string, index: number) {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function addDays(baseDate: Date, days: number, hour = 0, minute = 0) {
  return new Date(baseDate.getTime() + days * dayMs + hour * hourMs + minute * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * hourMs);
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

function buildPhone(index: number) {
  const digits = String(12000000 + index * 137).padStart(8, "0").slice(0, 8);
  return `04${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

function replaceAssigneeIdInMetadata(
  metadata: Prisma.AuditLogCreateManyInput["metadata"],
  idReplacements: Map<string, string>,
): Prisma.AuditLogCreateManyInput["metadata"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  if (!("assigneeId" in metadata) || typeof metadata.assigneeId !== "string") {
    return metadata;
  }

  return {
    ...metadata,
    assigneeId: idReplacements.get(metadata.assigneeId) ?? metadata.assigneeId,
  } as Prisma.AuditLogCreateManyInput["metadata"];
}

function buildUsers(staffProfiles: DemoSeedData["staffProfiles"], tenantId: string) {
  const ownerPasswordHash = bcrypt.hashSync("owner-password-123", 10);
  const managerPasswordHash = bcrypt.hashSync("manager-password-123", 10);
  const staffPasswordHash = bcrypt.hashSync("staff-password-123", 10);

  const users: BuiltUser[] = [
    {
      id: ownerId,
      email: "owner@acme.example",
      passwordHash: ownerPasswordHash,
      displayName: "Avery Owner",
    },
    {
      id: managerId,
      email: "manager@acme.example",
      passwordHash: managerPasswordHash,
      displayName: "Morgan Manager",
    },
    ...staffProfiles.map((staff) => ({
      id: staff.id,
      email: staff.email,
      passwordHash: staffPasswordHash,
      displayName: staff.displayName,
    })),
  ];

  const memberships: Prisma.MembershipCreateManyInput[] = [
    {
      userId: ownerId,
      tenantId,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
    {
      userId: managerId,
      tenantId,
      role: MembershipRole.MANAGER,
      status: MembershipStatus.ACTIVE,
    },
    ...staffProfiles.map((staff) => ({
      userId: staff.id,
      tenantId,
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
    })),
  ];

  return { users, memberships };
}

function buildCustomers(profile: DemoSeedProfile, baseDate: Date, tenantId: string) {
  const firstArchivedIndex = profile.customerCount - profile.archivedCustomerCount;

  return Array.from({ length: profile.customerCount }, (_, index): BuiltCustomer => {
    const oneBasedIndex = index + 1;
    const firstName = pick(customerFirstNames, index);
    const lastName = pick(customerLastNames, index * 7);
    const suburb = pick(suburbs, index * 3);
    const archivedAt = index >= firstArchivedIndex ? addDays(baseDate, -(60 + index), 9) : null;

    return {
      id: demoId("30000000", oneBasedIndex),
      tenantId,
      name: `${firstName} ${lastName}`,
      phone: buildPhone(oneBasedIndex),
      email: `${firstName}.${lastName}.${oneBasedIndex}@example.com`.toLowerCase(),
      address: `${12 + ((index * 17) % 180)} ${pick(streetNames, index * 5)}, ${suburb} SA`,
      notes:
        index % 5 === 0
          ? "Prefers SMS before arrival. Dog on site, use side gate if no answer."
          : index % 7 === 0
            ? "Property managed by a local agency. Confirm access window before dispatch."
            : null,
      archivedAt,
      createdById: index % 3 === 0 ? ownerId : managerId,
    };
  });
}

function buildJobData(input: {
  baseDate: Date;
  customers: BuiltCustomer[];
  profile: DemoSeedProfile;
  staffProfiles: DemoSeedData["staffProfiles"];
  tenantId: string;
}) {
  const { baseDate, customers, profile, staffProfiles, tenantId } = input;
  const activeCustomerIds = customers
    .filter((customer) => !customer.archivedAt)
    .map((customer) => customer.id);
  const archivedCustomerIds = customers
    .filter((customer) => customer.archivedAt)
    .map((customer) => customer.id);
  const staffIds = staffProfiles.map((staff) => staff.id);
  const jobs: BuiltJob[] = [];
  const statusHistory: Prisma.JobStatusHistoryCreateManyInput[] = [];
  const completionReviews: Prisma.JobCompletionReviewCreateManyInput[] = [];
  const auditLogs: Prisma.AuditLogCreateManyInput[] = [];
  let terminalCustomerCursor = 0;
  let reviewCursor = 0;

  function pickCustomerForStatus(status: JobStatus, index: number) {
    if (status === JobStatus.COMPLETED || status === JobStatus.CANCELLED) {
      const terminalIndex = terminalCustomerCursor;
      terminalCustomerCursor += 1;

      if (terminalIndex < archivedCustomerIds.length) {
        return archivedCustomerIds[terminalIndex];
      }

      if (archivedCustomerIds.length > 0 && terminalIndex % 5 === 0) {
        return pick(archivedCustomerIds, terminalIndex);
      }
    }

    return pick(activeCustomerIds, index * 7 + jobs.length);
  }

  function pushAuditLog(log: Prisma.AuditLogCreateManyInput) {
    auditLogs.push({
      tenantId,
      createdAt: addDays(baseDate, -120, auditLogs.length % 24, (auditLogs.length * 7) % 60),
      ...log,
    });
  }

  function pushTransition(transition: {
    job: BuiltJob;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    changedById: string;
    reason?: string | null;
    changedAt: Date;
  }) {
    statusHistory.push({
      tenantId,
      jobId: transition.job.id,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      changedById: transition.changedById,
      reason: transition.reason ?? null,
      changedAt: transition.changedAt,
    });

    pushAuditLog({
      userId: transition.changedById,
      action: AuditAction.JOB_STATUS_TRANSITION,
      targetType: "job",
      targetId: transition.job.id,
      createdAt: transition.changedAt,
      metadata: {
        jobTitle: transition.job.title,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        reason: transition.reason ?? null,
      },
    });
  }

  function pushReview(reviewInput: {
    job: BuiltJob;
    status: JobCompletionReviewStatus;
    submittedAt: Date;
    submittedById: string;
    reviewedAt?: Date | null;
    reviewedById?: string | null;
    reviewNote?: string | null;
  }) {
    reviewCursor += 1;
    const reviewId = demoId("60000000", reviewCursor);

    completionReviews.push({
      id: reviewId,
      tenantId,
      jobId: reviewInput.job.id,
      submittedById: reviewInput.submittedById,
      submittedAt: reviewInput.submittedAt,
      completionNote: `${reviewInput.job.title} completed on site. Work area cleaned and customer updated.`,
      status: reviewInput.status,
      reviewedById: reviewInput.reviewedById ?? null,
      reviewedAt: reviewInput.reviewedAt ?? null,
      reviewNote: reviewInput.reviewNote ?? null,
      aiStatus:
        reviewInput.status === JobCompletionReviewStatus.PENDING
          ? JobCompletionAiStatus.NEEDS_REVIEW
          : JobCompletionAiStatus.APPROVED,
      aiSummary:
        reviewInput.status === JobCompletionReviewStatus.RETURNED
          ? "Completion note needs manager follow-up before final approval."
          : "Completion note is consistent with the scheduled scope.",
      aiFindings: [
        {
          label: "scope_match",
          outcome: reviewInput.status === JobCompletionReviewStatus.RETURNED ? "review" : "pass",
        },
        {
          label: "customer_update",
          outcome: "pass",
        },
      ],
    });

    pushAuditLog({
      userId: reviewInput.submittedById,
      action: AuditAction.JOB_COMPLETION_SUBMITTED,
      targetType: "job_completion_review",
      targetId: reviewId,
      createdAt: reviewInput.submittedAt,
      metadata: {
        jobId: reviewInput.job.id,
        jobTitle: reviewInput.job.title,
      },
    });

    if (
      reviewInput.status === JobCompletionReviewStatus.APPROVED &&
      reviewInput.reviewedAt &&
      reviewInput.reviewedById
    ) {
      pushAuditLog({
        userId: reviewInput.reviewedById,
        action: AuditAction.JOB_COMPLETION_APPROVED,
        targetType: "job_completion_review",
        targetId: reviewId,
        createdAt: reviewInput.reviewedAt,
        metadata: {
          jobId: reviewInput.job.id,
          jobTitle: reviewInput.job.title,
        },
      });
    }

    if (
      reviewInput.status === JobCompletionReviewStatus.RETURNED &&
      reviewInput.reviewedAt &&
      reviewInput.reviewedById
    ) {
      pushAuditLog({
        userId: reviewInput.reviewedById,
        action: AuditAction.JOB_COMPLETION_RETURNED,
        targetType: "job_completion_review",
        targetId: reviewId,
        createdAt: reviewInput.reviewedAt,
        metadata: {
          jobId: reviewInput.job.id,
          jobTitle: reviewInput.job.title,
          reviewNote: reviewInput.reviewNote ?? null,
        },
      });
    }
  }

  for (const [status, count] of Object.entries(profile.statusCounts) as Array<[JobStatus, number]>) {
    for (let statusIndex = 0; statusIndex < count; statusIndex += 1) {
      const jobNumber = jobs.length + 1;
      const template = pick(jobTemplates, jobNumber * 3);
      const suburb = pick(suburbs, jobNumber * 5);
      const assignedToId = status === JobStatus.NEW ? null : pick(staffIds, statusIndex + jobNumber);
      const startAt = buildScheduleStart(baseDate, status, statusIndex, jobNumber);
      const job: BuiltJob = {
        id: demoId("40000000", jobNumber),
        tenantId,
        customerId: pickCustomerForStatus(status, statusIndex),
        title: `${template.title} - ${suburb}`,
        description: template.description,
        status,
        createdById: jobNumber % 4 === 0 ? ownerId : managerId,
        assignedToId,
        scheduledAt: startAt,
        scheduledStartAt: startAt,
        scheduledEndAt: startAt ? addHours(startAt, 1 + (jobNumber % 3)) : null,
      };

      jobs.push(job);

      if (assignedToId) {
        const assignee = staffProfiles.find((staff) => staff.id === assignedToId);

        pushAuditLog({
          userId: job.createdById,
          action: AuditAction.JOB_ASSIGNED,
          targetType: "job",
          targetId: job.id,
          createdAt: addDays(baseDate, -60 + (jobNumber % 30), 8, jobNumber % 60),
          metadata: {
            jobTitle: job.title,
            assigneeId: assignedToId,
            assigneeName: assignee?.displayName ?? "Demo Technician",
            assigneeEmail: assignee?.email ?? null,
          },
        });
      }

      buildStatusHistoryForJob({
        baseDate,
        job,
        profile,
        statusIndex,
        pushTransition,
        pushReview,
      });
    }
  }

  for (const staff of staffProfiles) {
    pushAuditLog({
      userId: ownerId,
      action: AuditAction.MEMBERSHIP_UPDATED,
      targetType: "membership",
      createdAt: addDays(baseDate, -110 + (staffProfiles.indexOf(staff) % 12), 9),
      metadata: {
        memberEmail: staff.email,
        memberDisplayName: staff.displayName,
        previousRole: "STAFF",
        nextRole: "STAFF",
        previousStatus: "ACTIVE",
        nextStatus: "ACTIVE",
      },
    });
  }

  for (const customer of customers) {
    if (customer.archivedAt) {
      pushAuditLog({
        userId: managerId,
        action: AuditAction.CUSTOMER_ARCHIVED,
        targetType: "customer",
        targetId: customer.id,
        createdAt: customer.archivedAt,
        metadata: {
          customerName: customer.name,
        },
      });
    }
  }

  for (const customer of customers.slice(0, Math.min(3, customers.length))) {
    pushAuditLog({
      userId: ownerId,
      action: AuditAction.CUSTOMER_RESTORED,
      targetType: "customer",
      targetId: customer.id,
      createdAt: addDays(baseDate, -30 + customers.indexOf(customer), 11),
      metadata: {
        customerName: customer.name,
        previousArchivedAt: addDays(baseDate, -65 + customers.indexOf(customer), 10).toISOString(),
      },
    });
  }

  return {
    jobs,
    statusHistory,
    completionReviews,
    auditLogs,
  };
}

function buildScheduleStart(
  baseDate: Date,
  status: JobStatus,
  statusIndex: number,
  jobNumber: number,
) {
  if (status === JobStatus.NEW) {
    return null;
  }

  if (status === JobStatus.SCHEDULED) {
    return addDays(baseDate, 1 + (statusIndex % 24), 8 + (statusIndex % 8), (statusIndex % 2) * 30);
  }

  if (status === JobStatus.IN_PROGRESS) {
    return addDays(baseDate, -(statusIndex % 4), 8 + (jobNumber % 7), (jobNumber % 2) * 30);
  }

  if (status === JobStatus.PENDING_REVIEW) {
    return addDays(baseDate, -(2 + (statusIndex % 18)), 8 + (jobNumber % 7), 15);
  }

  if (status === JobStatus.COMPLETED) {
    return addDays(baseDate, -(5 + (statusIndex % 75)), 8 + (jobNumber % 7), 30);
  }

  return statusIndex % 5 === 0
    ? null
    : addDays(baseDate, -(3 + (statusIndex % 45)), 8 + (jobNumber % 7), 45);
}

function buildStatusHistoryForJob(input: {
  baseDate: Date;
  job: BuiltJob;
  profile: DemoSeedProfile;
  statusIndex: number;
  pushTransition: (transition: {
    job: BuiltJob;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    changedById: string;
    reason?: string | null;
    changedAt: Date;
  }) => void;
  pushReview: (review: {
    job: BuiltJob;
    status: JobCompletionReviewStatus;
    submittedAt: Date;
    submittedById: string;
    reviewedAt?: Date | null;
    reviewedById?: string | null;
    reviewNote?: string | null;
  }) => void;
}) {
  const { baseDate, job, profile, statusIndex, pushTransition, pushReview } = input;
  const assigneeId = job.assignedToId ?? primaryStaffId;
  const startAt = job.scheduledStartAt ?? addDays(baseDate, -(statusIndex + 1), 9);
  const scheduledAt = addHours(startAt, -72);
  const inProgressAt = addHours(startAt, 1);
  const pendingReviewAt = addHours(startAt, 3);
  const finalAt = addHours(startAt, 5);
  const cancellationVariant = job.status === JobStatus.CANCELLED ? statusIndex % 4 : null;
  const cancellationReason = pick(cancellationReasons, statusIndex);

  if (job.status === JobStatus.NEW) {
    return;
  }

  if (cancellationVariant === 0) {
    pushCancellation({
      job,
      fromStatus: JobStatus.NEW,
      changedById: managerId,
      changedAt: scheduledAt,
      reason: cancellationReason,
      pushTransition,
    });
    return;
  }

  pushTransition({
    job,
    fromStatus: JobStatus.NEW,
    toStatus: JobStatus.SCHEDULED,
    changedById: managerId,
    reason: "Scheduled for the next available technician.",
    changedAt: scheduledAt,
  });

  if (job.status === JobStatus.SCHEDULED) {
    return;
  }

  if (cancellationVariant === 1) {
    pushCancellation({
      job,
      fromStatus: JobStatus.SCHEDULED,
      changedById: managerId,
      changedAt: inProgressAt,
      reason: cancellationReason,
      pushTransition,
    });
    return;
  }

  pushTransition({
    job,
    fromStatus: JobStatus.SCHEDULED,
    toStatus: JobStatus.IN_PROGRESS,
    changedById: assigneeId,
    reason: "Technician arrived on site.",
    changedAt: inProgressAt,
  });

  if (job.status === JobStatus.IN_PROGRESS) {
    if (statusIndex < profile.returnedInProgressReviews) {
      const returnedAt = addHours(pendingReviewAt, 2);
      const reviewNote = pick(returnReasons, statusIndex);

      pushTransition({
        job,
        fromStatus: JobStatus.IN_PROGRESS,
        toStatus: JobStatus.PENDING_REVIEW,
        changedById: assigneeId,
        reason: "Completion submitted for review.",
        changedAt: pendingReviewAt,
      });
      pushTransition({
        job,
        fromStatus: JobStatus.PENDING_REVIEW,
        toStatus: JobStatus.IN_PROGRESS,
        changedById: managerId,
        reason: `Returned for rework: ${reviewNote}`,
        changedAt: returnedAt,
      });
      pushReview({
        job,
        status: JobCompletionReviewStatus.RETURNED,
        submittedAt: pendingReviewAt,
        submittedById: assigneeId,
        reviewedAt: returnedAt,
        reviewedById: managerId,
        reviewNote,
      });
    }

    return;
  }

  if (cancellationVariant === 2) {
    pushCancellation({
      job,
      fromStatus: JobStatus.IN_PROGRESS,
      changedById: managerId,
      changedAt: pendingReviewAt,
      reason: cancellationReason,
      pushTransition,
    });
    return;
  }

  pushTransition({
    job,
    fromStatus: JobStatus.IN_PROGRESS,
    toStatus: JobStatus.PENDING_REVIEW,
    changedById: assigneeId,
    reason: "Completion submitted for review.",
    changedAt: pendingReviewAt,
  });

  if (job.status === JobStatus.PENDING_REVIEW) {
    pushReview({
      job,
      status: JobCompletionReviewStatus.PENDING,
      submittedAt: pendingReviewAt,
      submittedById: assigneeId,
    });
    return;
  }

  if (job.status === JobStatus.COMPLETED) {
    pushTransition({
      job,
      fromStatus: JobStatus.PENDING_REVIEW,
      toStatus: JobStatus.COMPLETED,
      changedById: managerId,
      reason: "Completion review approved.",
      changedAt: finalAt,
    });
    pushReview({
      job,
      status: JobCompletionReviewStatus.APPROVED,
      submittedAt: pendingReviewAt,
      submittedById: assigneeId,
      reviewedAt: finalAt,
      reviewedById: managerId,
    });
    return;
  }

  pushCancellation({
    job,
    fromStatus: JobStatus.PENDING_REVIEW,
    changedById: managerId,
    changedAt: finalAt,
    reason: cancellationReason,
    pushTransition,
  });
}

function pushCancellation(input: {
  job: BuiltJob;
  fromStatus: JobStatus;
  changedById: string;
  changedAt: Date;
  reason: string;
  pushTransition: (transition: {
    job: BuiltJob;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    changedById: string;
    reason?: string | null;
    changedAt: Date;
  }) => void;
}) {
  input.pushTransition({
    job: input.job,
    fromStatus: input.fromStatus,
    toStatus: JobStatus.CANCELLED,
    changedById: input.changedById,
    reason: input.reason,
    changedAt: input.changedAt,
  });
}
