import { promises as fs } from "node:fs";
import path from "node:path";
import { AuditAction, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

const uploadsDirectory = path.resolve(process.cwd(), env.EVIDENCE_DIR);

function binaryParser(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error) => callback(error));
}

describeIfDb("evidence api integration", () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    await fs.rm(uploadsDirectory, { recursive: true, force: true });
  });

  afterAll(async () => {
    await resetDatabase();
    await fs.rm(uploadsDirectory, { recursive: true, force: true });
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

  async function seedCustomer(tenantId: string, createdById: string, name: string) {
    return prisma.customer.create({
      data: {
        tenantId,
        createdById,
        name,
      },
    });
  }

  it("allows owner to upload, list, download, and delete job evidence", async () => {
    const owner = await seedTenantUser({
      email: "owner@evidence-api.test",
      displayName: "Evidence Owner",
      role: MembershipRole.OWNER,
      tenantName: "Evidence API Tenant",
      tenantSlug: "evidence-api-tenant",
    });
    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Evidence Customer");
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Evidence Job",
        createdById: owner.user.id,
      },
    });

    const uploadResponse = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .field("kind", "SITE_PHOTO")
      .field("note", "Before repair")
      .attach("file", Buffer.from("image-data"), {
        filename: "before.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data.kind).toBe("SITE_PHOTO");
    expect(uploadResponse.body.data.note).toBe("Before repair");

    const listResponse = await request(app)
      .get(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const downloadResponse = await request(app)
      .get(`/api/jobs/${job.id}/evidence/${uploadResponse.body.data.id}/download`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .buffer(true)
      .parse(binaryParser);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("image/png");
    expect(downloadResponse.headers["content-disposition"]).toContain("before.png");
    expect(downloadResponse.body.equals(Buffer.from("image-data"))).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/api/jobs/${job.id}/evidence/${uploadResponse.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(deleteResponse.status).toBe(200);

    const remainingEvidence = await prisma.jobEvidence.findMany({
      where: {
        tenantId: owner.tenant.id,
        jobId: job.id,
      },
    });
    expect(remainingEvidence).toHaveLength(0);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        action: {
          in: [AuditAction.JOB_EVIDENCE_UPLOADED, AuditAction.JOB_EVIDENCE_DELETED],
        },
      },
    });
    expect(auditLogs).toHaveLength(2);
  });

  it("allows assigned staff to manage evidence, while hidden staff gets 404", async () => {
    const owner = await seedTenantUser({
      email: "owner@staff-evidence-api.test",
      displayName: "Owner",
      role: MembershipRole.OWNER,
      tenantName: "Staff Evidence Tenant",
      tenantSlug: "staff-evidence-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [staffUser, hiddenStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: "staff@staff-evidence-api.test",
          passwordHash,
          displayName: "Assigned Staff",
        },
      }),
      prisma.user.create({
        data: {
          email: "hidden@staff-evidence-api.test",
          passwordHash,
          displayName: "Hidden Staff",
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
          userId: hiddenStaffUser.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const [staffSession, hiddenStaffSession] = await Promise.all([
      login({
        email: staffUser.email,
        password: "password123",
        tenantId: owner.tenant.id,
      }),
      login({
        email: hiddenStaffUser.email,
        password: "password123",
        tenantId: owner.tenant.id,
      }),
    ]);

    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Staff Evidence Customer");
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Assigned Evidence Job",
        createdById: owner.user.id,
        assignedToId: staffUser.id,
      },
    });

    const staffUpload = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${staffSession.accessToken}`)
      .field("kind", "COMPLETION_PROOF")
      .attach("file", Buffer.from("proof-data"), {
        filename: "proof.pdf",
        contentType: "application/pdf",
      });

    expect(staffUpload.status).toBe(201);

    const hiddenStaffList = await request(app)
      .get(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${hiddenStaffSession.accessToken}`);
    expect(hiddenStaffList.status).toBe(404);

    const hiddenStaffUpload = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${hiddenStaffSession.accessToken}`)
      .field("kind", "ISSUE_EVIDENCE")
      .attach("file", Buffer.from("hidden"), {
        filename: "hidden.png",
        contentType: "image/png",
      });
    expect(hiddenStaffUpload.status).toBe(404);

    const hiddenStaffDelete = await request(app)
      .delete(`/api/jobs/${job.id}/evidence/${staffUpload.body.data.id}`)
      .set("Authorization", `Bearer ${hiddenStaffSession.accessToken}`);
    expect(hiddenStaffDelete.status).toBe(404);
  });

  it("rejects missing files, invalid mime types, and oversized uploads", async () => {
    const owner = await seedTenantUser({
      email: "owner@evidence-validation.test",
      displayName: "Validation Owner",
      role: MembershipRole.OWNER,
      tenantName: "Evidence Validation Tenant",
      tenantSlug: "evidence-validation-tenant",
    });
    const customer = await seedCustomer(owner.tenant.id, owner.user.id, "Validation Customer");
    const job = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        title: "Validation Job",
        createdById: owner.user.id,
      },
    });

    const missingFile = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .field("kind", "SITE_PHOTO");
    expect(missingFile.status).toBe(400);

    const invalidMime = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .field("kind", "CUSTOMER_DOCUMENT")
      .attach("file", Buffer.from("plain text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });
    expect(invalidMime.status).toBe(400);

    const oversized = await request(app)
      .post(`/api/jobs/${job.id}/evidence`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .field("kind", "SITE_PHOTO")
      .attach("file", Buffer.alloc(env.EVIDENCE_MAX_SIZE_BYTES + 1), {
        filename: "huge.png",
        contentType: "image/png",
      });
    expect(oversized.status).toBe(400);
  });
});
