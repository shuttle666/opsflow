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
      });

    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Noah Thompson");

    await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: created.body.data.id,
        title: "Leaking kitchen tap",
        serviceAddress: "18 Collins Street, Melbourne VIC 3000",
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
    expect(detail.body.data.jobStats).toEqual({ total: 1, open: 1 });
    expect(detail.body.data.jobs).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/customers/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Noah Thompson Updated",
        phone: "",
        email: "noah.updated@example.com",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Noah Thompson Updated");
    expect(updated.body.data.phone).toBeNull();
  });

  it("filters customer lists by contact availability", async () => {
    const { tenant, user, accessToken } = await seedTenantUser({
      email: "owner@customer-contact-api.test",
      displayName: "Owner Contact API",
      role: MembershipRole.OWNER,
      tenantName: "Customer Contact API Tenant",
      tenantSlug: "customer-contact-api-tenant",
    });

    await prisma.customer.createMany({
      data: [
        {
          tenantId: tenant.id,
          createdById: user.id,
          name: "Email Contact",
          email: "email-contact@example.com",
        },
        {
          tenantId: tenant.id,
          createdById: user.id,
          name: "Phone Contact",
          phone: "0412 000 010",
        },
        {
          tenantId: tenant.id,
          createdById: user.id,
          name: "Missing Contact",
        },
      ],
    });

    const withContact = await request(app)
      .get("/api/customers?contact=has_contact&page=1&pageSize=1&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(withContact.status).toBe(200);
    expect(withContact.body.data).toHaveLength(1);
    expect(withContact.body.meta.pagination).toMatchObject({
      total: 2,
      totalPages: 2,
    });

    const missingContact = await request(app)
      .get("/api/customers?contact=missing_contact&page=1&pageSize=10&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(missingContact.status).toBe(200);
    expect(missingContact.body.data.map((item: { name: string }) => item.name)).toEqual([
      "Missing Contact",
    ]);
    expect(missingContact.body.meta.pagination.total).toBe(1);

    const invalidContact = await request(app)
      .get("/api/customers?contact=unknown")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(invalidContact.status).toBe(400);
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

    const deleteRes = await request(app)
      .delete(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`);

    expect(deleteRes.status).toBe(403);

    const restoreRes = await request(app)
      .post(`/api/customers/${customer.id}/restore`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`);

    expect(restoreRes.status).toBe(403);
  });

  it("limits staff customer job details and stats to their own assignments", async () => {
    const owner = await seedTenantUser({
      email: "owner@customer-detail-rbac.test",
      displayName: "Customer Detail Owner",
      role: MembershipRole.OWNER,
      tenantName: "Customer Detail RBAC Tenant",
      tenantSlug: "customer-detail-rbac-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffUser, otherStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff@customer-detail-rbac.test",
          passwordHash,
          displayName: "Assigned Staff",
        },
      }),
      prisma.user.create({
        data: {
          email: "other-staff@customer-detail-rbac.test",
          passwordHash,
          displayName: "Other Staff",
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

    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Shared Customer",
        phone: "0412 000 099",
        email: "shared-customer@example.com",
      },
    });
    const jobs = await Promise.all([
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Assigned open job",
          serviceAddress: "1 Assigned Street, Adelaide SA 5000",
          status: JobStatus.NEW,
          assignedToId: staffUser.id,
          createdById: owner.user.id,
        },
      }),
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Assigned completed job",
          serviceAddress: "2 Assigned Street, Adelaide SA 5000",
          status: JobStatus.COMPLETED,
          assignedToId: staffUser.id,
          createdById: owner.user.id,
        },
      }),
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Other staff job",
          serviceAddress: "3 Hidden Street, Adelaide SA 5000",
          status: JobStatus.IN_PROGRESS,
          assignedToId: otherStaffUser.id,
          createdById: owner.user.id,
        },
      }),
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          title: "Unassigned job",
          serviceAddress: "4 Hidden Street, Adelaide SA 5000",
          status: JobStatus.SCHEDULED,
          createdById: owner.user.id,
        },
      }),
    ]);

    const staffDetail = await request(app)
      .get(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`);

    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.data).toMatchObject({
      phone: "0412 000 099",
      email: "shared-customer@example.com",
      jobStats: { total: 2, open: 1 },
    });
    expect(staffDetail.body.data.jobs.map((job: { id: string }) => job.id).sort()).toEqual(
      jobs
        .slice(0, 2)
        .map((job) => job.id)
        .sort(),
    );

    const ownerDetail = await request(app)
      .get(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body.data.jobStats).toEqual({ total: 4, open: 3 });
    expect(ownerDetail.body.data.jobs.map((job: { id: string }) => job.id).sort()).toEqual(
      jobs.map((job) => job.id).sort(),
    );
  });

  it("archives, filters, restores, and blocks customers with open jobs", async () => {
    const { tenant, user, accessToken } = await seedTenantUser({
      email: "owner@customer-archive-api.test",
      displayName: "Owner Archive API",
      role: MembershipRole.OWNER,
      tenantName: "Customer Archive API Tenant",
      tenantSlug: "customer-archive-api-tenant",
    });

    const activeCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        createdById: user.id,
        name: "Active API Customer",
      },
    });
    const archivableCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        createdById: user.id,
        name: "Archivable API Customer",
      },
    });
    const openJobCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        createdById: user.id,
        name: "Open Job API Customer",
      },
    });
    await prisma.job.create({
      data: {
        tenantId: tenant.id,
        customerId: openJobCustomer.id,
        title: "Open job",
        serviceAddress: "54 Toorak Road, South Yarra VIC 3141",
        status: JobStatus.IN_PROGRESS,
        createdById: user.id,
      },
    });

    const blocked = await request(app)
      .delete(`/api/customers/${openJobCustomer.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(blocked.status).toBe(409);

    const archived = await request(app)
      .delete(`/api/customers/${archivableCustomer.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(archived.status).toBe(200);
    expect(archived.body.data.archivedAt).toBeTruthy();

    const activeList = await request(app)
      .get("/api/customers?status=active&page=1&pageSize=10&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(activeList.status).toBe(200);
    expect(activeList.body.data.map((item: { id: string }) => item.id)).toContain(activeCustomer.id);
    expect(activeList.body.data.map((item: { id: string }) => item.id)).not.toContain(archivableCustomer.id);

    const archivedList = await request(app)
      .get("/api/customers?status=archived&page=1&pageSize=10&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(archivedList.status).toBe(200);
    expect(archivedList.body.data.map((item: { id: string }) => item.id)).toEqual([
      archivableCustomer.id,
    ]);

    const allList = await request(app)
      .get("/api/customers?status=all&page=1&pageSize=10&sort=name_asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(allList.status).toBe(200);
    expect(allList.body.data).toHaveLength(3);

    const restored = await request(app)
      .post(`/api/customers/${archivableCustomer.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.archivedAt).toBeNull();
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

    const archive = await request(app)
      .delete(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${secondary.accessToken}`);
    expect(archive.status).toBe(404);

    const restore = await request(app)
      .post(`/api/customers/${customer.id}/restore`)
      .set("Authorization", `Bearer ${secondary.accessToken}`);
    expect(restore.status).toBe(404);
  });
});
