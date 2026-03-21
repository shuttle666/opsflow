import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import type { AuthContext } from "../src/types/auth";
import {
  createCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "../src/modules/customer/customer.service";
import { hashPassword } from "../src/modules/auth/auth-password";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("customer service integration", () => {
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

  it("creates and lists customers within current tenant with search and pagination", async () => {
    const { auth } = await seedTenantUser({
      email: "owner@customer-service.test",
      displayName: "Owner",
      role: MembershipRole.OWNER,
      tenantName: "Customer Tenant",
      tenantSlug: "customer-tenant",
    });

    await createCustomer(auth, {
      name: "Noah Thompson",
      phone: "0412 000 001",
      email: "noah@example.com",
      address: "12 Glenview Rd",
    });
    await createCustomer(auth, {
      name: "Olivia Davis",
      phone: "0412 000 002",
      email: "olivia@example.com",
      address: "44 East Parkway",
    });

    const firstPage = await listCustomers(auth, {
      page: 1,
      pageSize: 1,
      q: undefined,
      sort: "name_asc",
    });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.name).toBe("Noah Thompson");
    expect(firstPage.pagination.total).toBe(2);
    expect(firstPage.pagination.totalPages).toBe(2);

    const searched = await listCustomers(auth, {
      page: 1,
      pageSize: 10,
      q: "0412 000 002",
      sort: "createdAt_desc",
    });

    expect(searched.items).toHaveLength(1);
    expect(searched.items[0]?.name).toBe("Olivia Davis");
  });

  it("loads customer detail with recent job summaries", async () => {
    const { auth, user } = await seedTenantUser({
      email: "manager@customer-detail.test",
      displayName: "Manager",
      role: MembershipRole.MANAGER,
      tenantName: "Detail Tenant",
      tenantSlug: "detail-tenant",
    });

    const staffPassword = await hashPassword("password123");
    const staff = await prisma.user.create({
      data: {
        email: "staff@customer-detail.test",
        passwordHash: staffPassword,
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

    const customer = await createCustomer(auth, {
      name: "Mia Clark",
      phone: "0412 000 006",
      email: "mia@example.com",
      address: "55 Franklin St",
    });

    await prisma.job.createMany({
      data: [
        {
          tenantId: auth.tenantId,
          customerId: customer.id,
          title: "Blocked drain",
          status: JobStatus.SCHEDULED,
          createdById: user.id,
          assignedToId: staff.id,
        },
        {
          tenantId: auth.tenantId,
          customerId: customer.id,
          title: "Leaking tap",
          status: JobStatus.NEW,
          createdById: user.id,
        },
      ],
    });

    const detail = await getCustomerDetail(auth, customer.id);

    expect(detail.name).toBe("Mia Clark");
    expect(detail.createdBy.email).toBe("manager@customer-detail.test");
    expect(detail.jobs).toHaveLength(2);
    expect(detail.jobs[0]?.title).toBeTruthy();
    expect(
      detail.jobs.some((job) => job.assignedToName === "Sam Staff"),
    ).toBe(true);
  });

  it("updates customer and blocks cross-tenant access", async () => {
    const primary = await seedTenantUser({
      email: "owner@customer-update.test",
      displayName: "Owner",
      role: MembershipRole.OWNER,
      tenantName: "Primary Tenant",
      tenantSlug: "primary-tenant",
    });
    const secondary = await seedTenantUser({
      email: "owner@other-tenant.test",
      displayName: "Other Owner",
      role: MembershipRole.OWNER,
      tenantName: "Other Tenant",
      tenantSlug: "other-tenant",
    });

    const customer = await createCustomer(primary.auth, {
      name: "James Lee",
      phone: "0412 000 007",
      email: "james@example.com",
      address: "72 Main North Rd",
    });

    const updated = await updateCustomer(primary.auth, customer.id, {
      name: "James Lee Updated",
      phone: "",
      email: "james.updated@example.com",
      address: "74 Main North Rd",
    });

    expect(updated.name).toBe("James Lee Updated");
    expect(updated.phone).toBeNull();

    await expect(
      getCustomerDetail(secondary.auth, customer.id),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    await expect(
      updateCustomer(secondary.auth, customer.id, {
        name: "Should Fail",
        phone: "",
        email: "",
        address: "",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
