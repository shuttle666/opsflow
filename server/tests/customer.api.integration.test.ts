import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("customer api integration", () => {
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

  it("returns 401 for unauthenticated customer list requests", async () => {
    const response = await request(app).get("/api/customers");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("allows owner to create/list/detail/update customers", async () => {
    const { tenant, user, accessToken } = await seedTenantUser({
      email: "owner@customer-api.test",
      displayName: "Owner API",
      role: MembershipRole.OWNER,
      tenantName: "Customer API Tenant",
      tenantSlug: "customer-api-tenant",
    });

    const created = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Noah Thompson",
        phone: "0412 000 001",
        email: "noah@example.com",
        address: "12 Glenview Rd",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Noah Thompson");

    await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: created.body.data.id,
        title: "Leaking kitchen tap",
        status: JobStatus.NEW,
        createdById: user.id,
      },
    });

    const listed = await request(app)
      .get("/api/customers?q=Noah&page=1&pageSize=10&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.pagination.total).toBe(1);

    const detail = await request(app)
      .get(`/api/customers/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.createdBy.email).toBe("owner@customer-api.test");
    expect(detail.body.data.jobs).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/customers/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Noah Thompson Updated",
        phone: "",
        email: "noah.updated@example.com",
        address: "14 Glenview Rd",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Noah Thompson Updated");
    expect(updated.body.data.phone).toBeNull();
  });

  it("forbids staff from creating or editing customers", async () => {
    const owner = await seedTenantUser({
      email: "owner@customer-rbac.test",
      displayName: "Owner RBAC",
      role: MembershipRole.OWNER,
      tenantName: "Customer RBAC Tenant",
      tenantSlug: "customer-rbac-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const staffUser = await prisma.user.create({
      data: {
        email: "staff@customer-rbac.test",
        passwordHash,
        displayName: "Staff RBAC",
      },
    });
    await prisma.membership.create({
      data: {
        userId: staffUser.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const staffSession = await login({
      email: staffUser.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Staff Forbidden Customer",
      },
    });

    const createRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        name: "Blocked Customer",
      });

    expect(createRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .send({
        name: "Blocked Edit",
      });

    expect(patchRes.status).toBe(403);
  });

  it("returns 404 when accessing a customer from another tenant", async () => {
    const primary = await seedTenantUser({
      email: "owner@primary-customer.test",
      displayName: "Primary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Primary Customer Tenant",
      tenantSlug: "primary-customer-tenant",
    });
    const secondary = await seedTenantUser({
      email: "owner@secondary-customer.test",
      displayName: "Secondary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Secondary Customer Tenant",
      tenantSlug: "secondary-customer-tenant",
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: primary.tenant.id,
        createdById: primary.user.id,
        name: "Cross Tenant Customer",
      },
    });

    const detail = await request(app)
      .get(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${secondary.accessToken}`);
    expect(detail.status).toBe(404);

    const update = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${secondary.accessToken}`)
      .send({
        name: "Should Fail",
      });
    expect(update.status).toBe(404);
  });
});
