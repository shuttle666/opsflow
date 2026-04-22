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

const ownerAccount = {
  id: ownerId,
  email: "owner@acme.example",
  password: "owner-password-123",
  displayName: "Maya Hart",
} as const;

const managerAccount = {
  id: managerId,
  email: "manager@acme.example",
  password: "manager-password-123",
  displayName: "Daniel Brooks",
} as const;

const staffPassword = "staff-password-123";

const allStaffProfiles = [
  {
    id: primaryStaffId,
    email: "staff@acme.example",
    displayName: "Sofia Nguyen",
  },
  {
    id: demoId("20000000", 4),
    email: "staff02@acme.example",
    displayName: "Ethan Caldwell",
  },
  {
    id: demoId("20000000", 5),
    email: "staff03@acme.example",
    displayName: "Priya Shah",
  },
  {
    id: demoId("20000000", 6),
    email: "staff04@acme.example",
    displayName: "Marcus Reed",
  },
  {
    id: demoId("20000000", 7),
    email: "staff05@acme.example",
    displayName: "Hannah O'Connor",
  },
  {
    id: demoId("20000000", 8),
    email: "staff06@acme.example",
    displayName: "Lucas Tan",
  },
  {
    id: demoId("20000000", 9),
    email: "staff07@acme.example",
    displayName: "Amelia Rossi",
  },
  {
    id: demoId("20000000", 10),
    email: "staff08@acme.example",
    displayName: "Noah Williams",
  },
  {
    id: demoId("20000000", 11),
    email: "staff09@acme.example",
    displayName: "Chloe Martin",
  },
  {
    id: demoId("20000000", 12),
    email: "staff10@acme.example",
    displayName: "Isaac Brown",
  },
] as const;

type CustomerProfile = {
  name: string;
  serviceAreaAddress: string;
  region: string;
};

type JobTemplate = {
  title: string;
  description: string;
};

const customerProfiles = [
  { name: "Aiden Murphy", serviceAreaAddress: "18 Collins Street, Melbourne VIC 3000", region: "CBD" },
  { name: "Mia Chen", serviceAreaAddress: "42 Queensbridge Street, Southbank VIC 3006", region: "CBD" },
  { name: "Eleanor Wright", serviceAreaAddress: "7 Bourke Street, Docklands VIC 3008", region: "CBD" },
  { name: "Oliver Haddad", serviceAreaAddress: "63 Rathdowne Street, Carlton VIC 3053", region: "Inner North" },
  { name: "Zara Patel", serviceAreaAddress: "25 Gertrude Street, Fitzroy VIC 3065", region: "Inner North" },
  { name: "Thomas Kelly", serviceAreaAddress: "89 Smith Street, Collingwood VIC 3066", region: "Inner North" },
  { name: "Amara Singh", serviceAreaAddress: "31 Swan Street, Richmond VIC 3121", region: "Inner East" },
  { name: "Luca Romano", serviceAreaAddress: "54 Toorak Road, South Yarra VIC 3141", region: "Inner South" },
  { name: "Sophie Gallagher", serviceAreaAddress: "16 Greville Street, Prahran VIC 3181", region: "Inner South" },
  { name: "Noah Ibrahim", serviceAreaAddress: "72 Acland Street, St Kilda VIC 3182", region: "Bayside" },
  { name: "Isabella Tran", serviceAreaAddress: "27 Bay Street, Port Melbourne VIC 3207", region: "Bayside" },
  { name: "Harry O'Neill", serviceAreaAddress: "44 Bridport Street, Albert Park VIC 3206", region: "Bayside" },
  { name: "Priya Nair", serviceAreaAddress: "93 Sydney Road, Brunswick VIC 3056", region: "Inner North" },
  { name: "Mason Clarke", serviceAreaAddress: "38 Bell Street, Coburg VIC 3058", region: "North" },
  { name: "Grace Yamamoto", serviceAreaAddress: "12 High Street, Northcote VIC 3070", region: "Inner North" },
  { name: "Finn Walsh", serviceAreaAddress: "64 Normanby Avenue, Thornbury VIC 3071", region: "North" },
  { name: "Hannah Kim", serviceAreaAddress: "21 Plenty Road, Preston VIC 3072", region: "North" },
  { name: "Sebastian Rossi", serviceAreaAddress: "84 Buckley Street, Essendon VIC 3040", region: "North West" },
  { name: "Charlotte Nguyen", serviceAreaAddress: "33 Puckle Street, Moonee Ponds VIC 3039", region: "North West" },
  { name: "Leo Simmons", serviceAreaAddress: "58 Errol Street, North Melbourne VIC 3051", region: "Inner West" },
  { name: "Layla Brooks", serviceAreaAddress: "46 Hopkins Street, Footscray VIC 3011", region: "West" },
  { name: "Archer Campbell", serviceAreaAddress: "19 Anderson Street, Yarraville VIC 3013", region: "West" },
  { name: "Emily Farah", serviceAreaAddress: "75 Charles Street, Seddon VIC 3011", region: "West" },
  { name: "Joshua Bennett", serviceAreaAddress: "23 Ferguson Street, Williamstown VIC 3016", region: "Bayside West" },
  { name: "Chloe Anderson", serviceAreaAddress: "57 Mason Street, Newport VIC 3015", region: "Bayside West" },
  { name: "Daniel Hart", serviceAreaAddress: "91 Pier Street, Altona VIC 3018", region: "Bayside West" },
  { name: "Aaliyah Hassan", serviceAreaAddress: "28 Hampshire Road, Sunshine VIC 3020", region: "West" },
  { name: "Nathan Foster", serviceAreaAddress: "67 Watton Street, Werribee VIC 3030", region: "Outer West" },
  { name: "Ruby McKenzie", serviceAreaAddress: "14 Derrimut Road, Tarneit VIC 3029", region: "Outer West" },
  { name: "Elijah Tan", serviceAreaAddress: "82 Dunnings Road, Point Cook VIC 3030", region: "Outer West" },
  { name: "Abigail Morris", serviceAreaAddress: "36 Glenferrie Road, Hawthorn VIC 3122", region: "East" },
  { name: "Jasper Lee", serviceAreaAddress: "70 Cotham Road, Kew VIC 3101", region: "East" },
  { name: "Nina Desai", serviceAreaAddress: "24 Burke Road, Camberwell VIC 3124", region: "East" },
  { name: "Ethan Parker", serviceAreaAddress: "88 Whitehorse Road, Balwyn VIC 3103", region: "East" },
  { name: "Maya Goldberg", serviceAreaAddress: "45 Station Street, Box Hill VIC 3128", region: "East" },
  { name: "Owen Russell", serviceAreaAddress: "11 Doncaster Road, Doncaster VIC 3108", region: "East" },
  { name: "Sienna Taylor", serviceAreaAddress: "79 Maroondah Highway, Ringwood VIC 3134", region: "Outer East" },
  { name: "Maxwell Chen", serviceAreaAddress: "32 Blackburn Road, Blackburn VIC 3130", region: "East" },
  { name: "Eva Phillips", serviceAreaAddress: "55 Kingsway, Glen Waverley VIC 3150", region: "South East" },
  { name: "Louis Nguyen", serviceAreaAddress: "17 Stephensons Road, Mount Waverley VIC 3149", region: "South East" },
  { name: "Zoe Martin", serviceAreaAddress: "61 Burwood Highway, Burwood VIC 3125", region: "East" },
  { name: "Caleb Wilson", serviceAreaAddress: "29 Glenferrie Road, Malvern VIC 3144", region: "Inner South East" },
  { name: "Ivy Ahmed", serviceAreaAddress: "83 Hawthorn Road, Caulfield VIC 3162", region: "Inner South East" },
  { name: "Aaron Davies", serviceAreaAddress: "41 Koornang Road, Carnegie VIC 3163", region: "South East" },
  { name: "Matilda Scott", serviceAreaAddress: "26 Centre Road, Bentleigh VIC 3204", region: "South East" },
  { name: "Samuel Brooks", serviceAreaAddress: "94 Bluff Road, Sandringham VIC 3191", region: "Bayside" },
  { name: "Freya Wallace", serviceAreaAddress: "50 Ormond Road, Elwood VIC 3184", region: "Bayside" },
  { name: "Benjamin Reid", serviceAreaAddress: "13 Hampton Street, Hampton VIC 3188", region: "Bayside" },
  { name: "Lily Carter", serviceAreaAddress: "68 South Road, Moorabbin VIC 3189", region: "Bayside" },
  { name: "Tyler Moore", serviceAreaAddress: "22 Charman Road, Cheltenham VIC 3192", region: "Bayside" },
  { name: "Sarah Malik", serviceAreaAddress: "87 Atherton Road, Oakleigh VIC 3166", region: "South East" },
  { name: "Xavier King", serviceAreaAddress: "35 Clayton Road, Clayton VIC 3168", region: "South East" },
  { name: "Madison Allen", serviceAreaAddress: "59 Springvale Road, Springvale VIC 3171", region: "South East" },
  { name: "Hamish Fraser", serviceAreaAddress: "18 Lonsdale Street, Dandenong VIC 3175", region: "South East" },
  { name: "Ava Robinson", serviceAreaAddress: "73 Wellington Road, Mulgrave VIC 3170", region: "South East" },
  { name: "Patrick Li", serviceAreaAddress: "40 Douglas Street, Noble Park VIC 3174", region: "South East" },
  { name: "Jasmine Walker", serviceAreaAddress: "96 High Street, Berwick VIC 3806", region: "Outer South East" },
  { name: "Connor Evans", serviceAreaAddress: "52 Webb Street, Narre Warren VIC 3805", region: "Outer South East" },
  { name: "Olivia Graham", serviceAreaAddress: "30 Sladen Street, Cranbourne VIC 3977", region: "Outer South East" },
  { name: "Blake Mitchell", serviceAreaAddress: "76 Wells Street, Frankston VIC 3199", region: "Bayside South" },
  { name: "Harper Adams", serviceAreaAddress: "15 Upper Heidelberg Road, Ivanhoe VIC 3079", region: "North East" },
  { name: "Riley Stone", serviceAreaAddress: "66 Burgundy Street, Heidelberg VIC 3084", region: "North East" },
  { name: "Molly Jenkins", serviceAreaAddress: "37 Rosanna Road, Rosanna VIC 3084", region: "North East" },
  { name: "Isaac Powell", serviceAreaAddress: "81 Main Street, Greensborough VIC 3088", region: "North East" },
  { name: "Lucy Hernandez", serviceAreaAddress: "20 Plenty Road, Bundoora VIC 3083", region: "North" },
  { name: "Dylan Turner", serviceAreaAddress: "62 High Street, Epping VIC 3076", region: "Outer North" },
  { name: "Georgia Bailey", serviceAreaAddress: "34 McDonalds Road, South Morang VIC 3752", region: "Outer North" },
  { name: "Cooper Nelson", serviceAreaAddress: "90 Spring Street, Reservoir VIC 3073", region: "North" },
  { name: "Clara Hughes", serviceAreaAddress: "47 Wheatsheaf Road, Glenroy VIC 3046", region: "North West" },
  { name: "Logan Stewart", serviceAreaAddress: "25 Gaffney Street, Pascoe Vale VIC 3044", region: "North West" },
  { name: "Poppy Reynolds", serviceAreaAddress: "69 Melrose Drive, Tullamarine VIC 3043", region: "North West" },
  { name: "Callum Price", serviceAreaAddress: "10 Milleara Road, Keilor East VIC 3033", region: "North West" },
  { name: "Ella Freeman", serviceAreaAddress: "56 Matthews Avenue, Airport West VIC 3042", region: "North West" },
  { name: "Marcus Young", serviceAreaAddress: "39 Raleigh Road, Maribyrnong VIC 3032", region: "Inner West" },
  { name: "Nora Chapman", serviceAreaAddress: "71 Union Road, Ascot Vale VIC 3032", region: "Inner North West" },
  { name: "Lachlan Gray", serviceAreaAddress: "44 Racecourse Road, Flemington VIC 3031", region: "Inner North West" },
  { name: "Ariana Morris", serviceAreaAddress: "8 Johnston Street, Abbotsford VIC 3067", region: "Inner East" },
  { name: "Felix Ward", serviceAreaAddress: "53 Heidelberg Road, Alphington VIC 3078", region: "Inner North East" },
  { name: "Victoria Blake", serviceAreaAddress: "27 Station Street, Fairfield VIC 3078", region: "Inner North" },
  { name: "Jayden Cook", serviceAreaAddress: "65 Queens Parade, Clifton Hill VIC 3068", region: "Inner North" },
] satisfies CustomerProfile[];

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
  {
    title: "Roof gutter overflow",
    description: "Front gutter overflows during heavy rain and needs clearing plus a downpipe check.",
  },
  {
    title: "Bathroom exhaust fan fault",
    description: "Exhaust fan is noisy and airflow is weak after several minutes of operation.",
  },
  {
    title: "Oven not heating evenly",
    description: "Customer reports uneven heating and longer cooking times from the electric oven.",
  },
  {
    title: "Laundry cabinet repair",
    description: "Laundry cabinet hinge has pulled loose and the door is no longer closing squarely.",
  },
  {
    title: "Security light adjustment",
    description: "Motion sensor light is triggering late and needs repositioning near the side path.",
  },
  {
    title: "Toilet cistern running",
    description: "Toilet cistern continues running after flush and customer can hear water overnight.",
  },
  {
    title: "Split-system fault diagnosis",
    description: "Split-system starts normally, then shuts down before reaching the set temperature.",
  },
  {
    title: "Window latch replacement",
    description: "Bedroom window latch is broken and customer needs it secured before the weekend.",
  },
  {
    title: "Stormwater drain inspection",
    description: "Water is pooling near the driveway after rain and stormwater flow needs checking.",
  },
  {
    title: "Decking board repair",
    description: "One deck board has lifted near the back step and is creating a trip hazard.",
  },
  {
    title: "Intercom handset fault",
    description: "Apartment intercom handset rings but audio is distorted during visitor calls.",
  },
  {
    title: "Wardrobe sliding door repair",
    description: "Sliding wardrobe door has come off its track and needs rollers adjusted.",
  },
] satisfies JobTemplate[];

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

const jobAccessNotes = [
  "Customer prefers a text message 20 minutes before arrival.",
  "Use the side gate if there is no answer at the front door.",
  "Parking is usually easier on the nearest side street.",
  "Property manager can provide access if the customer is not home.",
  "Avoid school pickup traffic when planning the arrival window.",
  "Customer works from home and prefers a quiet knock rather than the doorbell.",
];

const serviceStreetNames = [
  "Market Lane",
  "Station Street",
  "Garden Avenue",
  "Victoria Parade",
  "Albert Road",
  "Park Street",
  "Riverside Drive",
  "Union Street",
  "Highland Crescent",
  "Bridge Road",
  "Wellington Street",
  "Oak Grove",
  "Civic Way",
  "Miller Street",
  "Harcourt Avenue",
  "Lygon Street",
  "Barkly Street",
  "Domain Road",
  "Mason Avenue",
  "Harris Street",
  "Rose Street",
  "Nelson Road",
  "King Street",
  "Queens Lane",
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
  assertSeedProfileReady(profile);

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

  assertUniqueValues(
    `job service addresses for ${profile.name}`,
    jobs.map((job) => job.serviceAddress),
  );

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

function assertSeedProfileReady(profile: DemoSeedProfile) {
  if (profile.customerCount > customerProfiles.length) {
    throw new Error(
      `Demo seed profile ${profile.name} needs ${profile.customerCount} customers, but only ${customerProfiles.length} are defined.`,
    );
  }

  if (profile.staffCount > allStaffProfiles.length) {
    throw new Error(
      `Demo seed profile ${profile.name} needs ${profile.staffCount} staff members, but only ${allStaffProfiles.length} are defined.`,
    );
  }

  const selectedCustomers = customerProfiles.slice(0, profile.customerCount);
  const selectedStaff = allStaffProfiles.slice(0, profile.staffCount);

  assertUniqueValues(
    `customer names for ${profile.name}`,
    selectedCustomers.map((customer) => customer.name),
  );
  assertUniqueValues(
    `team member names for ${profile.name}`,
    [
      ownerAccount.displayName,
      managerAccount.displayName,
      ...selectedStaff.map((staff) => staff.displayName),
    ],
  );
}

function assertUniqueValues(label: string, values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} value in demo seed: ${value}`);
    }

    seen.add(value);
  }
}

function buildEmailLocalPart(name: string, index: number) {
  const normalizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `${normalizedName}.${String(index).padStart(2, "0")}`;
}

function extractSuburbFromAddress(serviceAreaAddress: string | null | undefined) {
  const match = serviceAreaAddress?.match(/,\s*(.+?)\s+VIC\s+\d{4}$/);
  return match?.[1] ?? "Melbourne";
}

function extractPostcodeFromAddress(serviceAreaAddress: string | null | undefined) {
  const match = serviceAreaAddress?.match(/VIC\s+(\d{4})$/);
  return match?.[1] ?? "3000";
}

function buildServiceAddress(jobNumber: number, suburb: string, postcode: string) {
  const streetNumber = 8 + ((jobNumber * 17) % 920);
  const street = pick(serviceStreetNames, jobNumber * 7);
  const unitPrefix = jobNumber % 11 === 0 ? `Unit ${1 + (jobNumber % 18)}, ` : "";

  return `${unitPrefix}${streetNumber} ${street}, ${suburb} VIC ${postcode}`;
}

function buildJobDescription(
  template: JobTemplate,
  status: JobStatus,
  statusIndex: number,
  suburb: string,
) {
  const accessNote = pick(jobAccessNotes, statusIndex);
  const statusContext = {
    [JobStatus.NEW]: "Needs triage before booking a technician.",
    [JobStatus.SCHEDULED]: `Booked into the ${suburb} service run.`,
    [JobStatus.IN_PROGRESS]: "Technician is on site or actively working through the checklist.",
    [JobStatus.PENDING_REVIEW]: "Completion details have been submitted for manager review.",
    [JobStatus.COMPLETED]: "Historical job retained for reporting and customer context.",
    [JobStatus.CANCELLED]: "No dispatch required; cancellation reason is recorded in the status history.",
  } satisfies Record<JobStatus, string>;

  return `${template.description} ${accessNote} ${statusContext[status]}`;
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
  const ownerPasswordHash = bcrypt.hashSync(ownerAccount.password, 10);
  const managerPasswordHash = bcrypt.hashSync(managerAccount.password, 10);
  const staffPasswordHash = bcrypt.hashSync(staffPassword, 10);

  const users: BuiltUser[] = [
    {
      id: ownerAccount.id,
      email: ownerAccount.email,
      passwordHash: ownerPasswordHash,
      displayName: ownerAccount.displayName,
    },
    {
      id: managerAccount.id,
      email: managerAccount.email,
      passwordHash: managerPasswordHash,
      displayName: managerAccount.displayName,
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
      userId: ownerAccount.id,
      tenantId,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
    {
      userId: managerAccount.id,
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

  return customerProfiles.slice(0, profile.customerCount).map((customerProfile, index): BuiltCustomer => {
    const oneBasedIndex = index + 1;
    const archivedAt = index >= firstArchivedIndex ? addDays(baseDate, -(60 + index), 9) : null;

    return {
      id: demoId("30000000", oneBasedIndex),
      tenantId,
      name: customerProfile.name,
      phone: buildPhone(oneBasedIndex),
      email: `${buildEmailLocalPart(customerProfile.name, oneBasedIndex)}@example.com`,
      notes:
        index % 5 === 0
          ? `Prefers SMS before arrival. ${customerProfile.region} access can be busy during school pickup.`
          : index % 7 === 0
            ? `Property managed by a local agency. Confirm the ${customerProfile.region} access window before dispatch.`
            : null,
      archivedAt,
      createdById: index % 3 === 0 ? ownerAccount.id : managerAccount.id,
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
  const customerSuburbsById = new Map(
    customers.map((customer, index) => [
      customer.id,
      extractSuburbFromAddress(customerProfiles[index]?.serviceAreaAddress),
    ]),
  );
  const customerPostcodesById = new Map(
    customers.map((customer, index) => [
      customer.id,
      extractPostcodeFromAddress(customerProfiles[index]?.serviceAreaAddress),
    ]),
  );
  const customerIndexesById = new Map(customers.map((customer, index) => [customer.id, index]));
  const customerJobCounts = new Map<string, number>();
  const staffIds = staffProfiles.map((staff) => staff.id);
  const jobs: BuiltJob[] = [];
  const statusHistory: Prisma.JobStatusHistoryCreateManyInput[] = [];
  const completionReviews: Prisma.JobCompletionReviewCreateManyInput[] = [];
  const auditLogs: Prisma.AuditLogCreateManyInput[] = [];
  let activeCustomerCursor = 0;
  let terminalCustomerCursor = 0;
  let reviewCursor = 0;

  function pickCustomerForStatus(status: JobStatus) {
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

    const activeIndex = activeCustomerCursor;
    activeCustomerCursor += 1;

    return pick(activeCustomerIds, activeIndex);
  }

  function pickJobTemplateForCustomer(customerId: string) {
    const customerIndex = customerIndexesById.get(customerId) ?? 0;
    const customerJobIndex = customerJobCounts.get(customerId) ?? 0;

    customerJobCounts.set(customerId, customerJobIndex + 1);

    return pick(jobTemplates, customerIndex * 5 + customerJobIndex * 7);
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
      const assignedToId = status === JobStatus.NEW ? null : pick(staffIds, statusIndex + jobNumber);
      const startAt = buildScheduleStart(baseDate, status, statusIndex, jobNumber);
      const customerId = pickCustomerForStatus(status);
      const template = pickJobTemplateForCustomer(customerId);
      const suburb = customerSuburbsById.get(customerId) ?? "Melbourne";
      const serviceAddress = buildServiceAddress(
        jobNumber,
        suburb,
        customerPostcodesById.get(customerId) ?? "3000",
      );
      const job: BuiltJob = {
        id: demoId("40000000", jobNumber),
        tenantId,
        customerId,
        title: `${template.title} - ${suburb}`,
        serviceAddress,
        description: buildJobDescription(template, status, statusIndex, suburb),
        status,
        createdById: jobNumber % 4 === 0 ? ownerAccount.id : managerAccount.id,
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
      userId: ownerAccount.id,
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
        userId: managerAccount.id,
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
      userId: ownerAccount.id,
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
      changedById: managerAccount.id,
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
    changedById: managerAccount.id,
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
      changedById: managerAccount.id,
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
        changedById: managerAccount.id,
        reason: `Returned for rework: ${reviewNote}`,
        changedAt: returnedAt,
      });
      pushReview({
        job,
        status: JobCompletionReviewStatus.RETURNED,
        submittedAt: pendingReviewAt,
        submittedById: assigneeId,
        reviewedAt: returnedAt,
        reviewedById: managerAccount.id,
        reviewNote,
      });
    }

    return;
  }

  if (cancellationVariant === 2) {
    pushCancellation({
      job,
      fromStatus: JobStatus.IN_PROGRESS,
      changedById: managerAccount.id,
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
      changedById: managerAccount.id,
      reason: "Completion review approved.",
      changedAt: finalAt,
    });
    pushReview({
      job,
      status: JobCompletionReviewStatus.APPROVED,
      submittedAt: pendingReviewAt,
      submittedById: assigneeId,
      reviewedAt: finalAt,
      reviewedById: managerAccount.id,
    });
    return;
  }

  pushCancellation({
    job,
    fromStatus: JobStatus.PENDING_REVIEW,
    changedById: managerAccount.id,
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
