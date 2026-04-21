import { AuditAction, JobStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import type {
  CreateCustomerInput,
  CustomerListQueryInput,
  UpdateCustomerInput,
} from "./customer-schemas";

type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerJobSummary = {
  id: string;
  title: string;
  status: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  assignedToName?: string;
};

type CustomerDetail = CustomerListItem & {
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  jobs: CustomerJobSummary[];
};

type CustomerListResult = {
  items: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const openJobStatuses = [
  JobStatus.NEW,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
  JobStatus.PENDING_REVIEW,
];

function buildCustomerSearchWhere(auth: AuthContext, query: CustomerListQueryInput) {
  const normalizedQuery = query.q?.trim();

  return {
    tenantId: auth.tenantId,
    ...(query.status === "archived"
      ? { archivedAt: { not: null } }
      : query.status === "all"
        ? {}
        : { archivedAt: null }),
    ...(normalizedQuery
      ? {
          OR: [
            {
              name: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              phone: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.CustomerWhereInput;
}

function buildCustomerOrderBy(sort: CustomerListQueryInput["sort"]) {
  switch (sort) {
    case "createdAt_asc":
      return { createdAt: "asc" } satisfies Prisma.CustomerOrderByWithRelationInput;
    case "name_asc":
      return { name: "asc" } satisfies Prisma.CustomerOrderByWithRelationInput;
    case "name_desc":
      return { name: "desc" } satisfies Prisma.CustomerOrderByWithRelationInput;
    case "createdAt_desc":
    default:
      return { createdAt: "desc" } satisfies Prisma.CustomerOrderByWithRelationInput;
  }
}

async function getCustomerOrThrow(auth: AuthContext, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return customer;
}

export async function listCustomers(
  auth: AuthContext,
  query: CustomerListQueryInput,
): Promise<CustomerListResult> {
  const where = buildCustomerSearchWhere(auth, query);
  const orderBy = buildCustomerOrderBy(query.sort);
  const skip = (query.page - 1) * query.pageSize;

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    items: customers,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function createCustomer(
  auth: AuthContext,
  input: CreateCustomerInput,
): Promise<CustomerListItem> {
  return prisma.customer.create({
    data: {
      tenantId: auth.tenantId,
      createdById: auth.userId,
      name: input.name.trim(),
      phone: normalizeOptionalString(input.phone),
      email: normalizeOptionalString(input.email),
      address: normalizeOptionalString(input.address),
      notes: normalizeOptionalString(input.notes),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getCustomerDetail(
  auth: AuthContext,
  customerId: string,
): Promise<CustomerDetail> {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      jobs: {
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          assignedTo: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
    archivedAt: customer.archivedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    createdBy: customer.createdBy,
    jobs: customer.jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      scheduledStartAt: job.scheduledStartAt,
      scheduledEndAt: job.scheduledEndAt,
      ...(job.assignedTo?.displayName
        ? { assignedToName: job.assignedTo.displayName }
        : {}),
    })),
  };
}

export async function updateCustomer(
  auth: AuthContext,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<CustomerListItem> {
  await getCustomerOrThrow(auth, customerId);

  return prisma.customer.update({
    where: {
      id: customerId,
    },
    data: {
      name: input.name.trim(),
      phone: normalizeOptionalString(input.phone),
      email: normalizeOptionalString(input.email),
      address: normalizeOptionalString(input.address),
      notes: normalizeOptionalString(input.notes),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function archiveCustomer(
  auth: AuthContext,
  customerId: string,
  metadata?: RequestMetadata,
): Promise<CustomerListItem> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new ApiError(404, "Customer not found.");
    }

    if (customer.archivedAt) {
      return customer;
    }

    const openJobCount = await tx.job.count({
      where: {
        tenantId: auth.tenantId,
        customerId: customer.id,
        status: {
          in: openJobStatuses,
        },
      },
    });

    if (openJobCount > 0) {
      throw new ApiError(
        409,
        "Complete or cancel this customer's open jobs before deleting the customer.",
      );
    }

    const archived = await tx.customer.update({
      where: {
        id: customer.id,
      },
      data: {
        archivedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.CUSTOMER_ARCHIVED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "customer",
        targetId: customer.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
        },
      },
    });

    return archived;
  });
}

export async function restoreCustomer(
  auth: AuthContext,
  customerId: string,
  metadata?: RequestMetadata,
): Promise<CustomerListItem> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new ApiError(404, "Customer not found.");
    }

    if (!customer.archivedAt) {
      return customer;
    }

    const restored = await tx.customer.update({
      where: {
        id: customer.id,
      },
      data: {
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.CUSTOMER_RESTORED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "customer",
        targetId: customer.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
        },
      },
    });

    return restored;
  });
}
