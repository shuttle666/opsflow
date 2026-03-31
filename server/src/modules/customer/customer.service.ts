import { type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
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
  createdAt: Date;
  updatedAt: Date;
};

type CustomerJobSummary = {
  id: string;
  title: string;
  status: string;
  scheduledAt: Date | null;
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

function buildCustomerSearchWhere(auth: AuthContext, query: CustomerListQueryInput) {
  const normalizedQuery = query.q?.trim();

  return {
    tenantId: auth.tenantId,
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
          scheduledAt: true,
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
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    createdBy: customer.createdBy,
    jobs: customer.jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      scheduledAt: job.scheduledAt,
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
      createdAt: true,
      updatedAt: true,
    },
  });
}
