import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  assertProductionDemoSeedConfirmation,
  buildDemoSeedData,
  demoSeedProfiles,
  demoTenant,
  getExpectedDemoUserIdentityByEmail,
  getExpectedDemoUserIdentityById,
  printDemoSeedSummary,
  remapDemoSeedUserIds,
} from "./demo-data";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to reset production demo data.");
}

assertProductionDemoSeedConfirmation();

const pool = new Pool({
  connectionString,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  let seededData: ReturnType<typeof buildDemoSeedData> | undefined;

  await prisma.$transaction(async (tx) => {
    const existingTenant = await tx.tenant.findUnique({
      where: { slug: demoTenant.slug },
      select: { id: true },
    });
    const existingTenantById = await tx.tenant.findUnique({
      where: { id: demoTenant.id },
      select: { slug: true },
    });

    if (!existingTenant && existingTenantById && existingTenantById.slug !== demoTenant.slug) {
      throw new Error(
        `Refusing to reset tenant id ${demoTenant.id}; expected slug ${demoTenant.slug}, found ${existingTenantById.slug}.`,
      );
    }

    const tenantId = existingTenant?.id ?? demoTenant.id;
    const data = buildDemoSeedData(demoSeedProfiles.productionSmall, { tenantId });
    const usersByEmail = getExpectedDemoUserIdentityByEmail(data);
    const usersById = getExpectedDemoUserIdentityById(data);
    const userIdReplacements = new Map<string, string>();
    const existingUsers = await tx.user.findMany({
      where: {
        OR: [
          { email: { in: Array.from(usersByEmail.keys()) } },
          { id: { in: Array.from(usersById.keys()) } },
        ],
      },
      select: {
        id: true,
        email: true,
      },
    });

    for (const user of existingUsers) {
      const expectedByEmail = usersByEmail.get(user.email);
      const expectedById = usersById.get(user.id);

      if (expectedById && expectedById.email !== user.email) {
        throw new Error(
          `Refusing to take over demo user id ${user.id}; expected email ${expectedById.email}, found ${user.email}.`,
        );
      }

      if (expectedByEmail && expectedByEmail.id !== user.id) {
        userIdReplacements.set(expectedByEmail.id, user.id);
      }
    }

    remapDemoSeedUserIds(data, userIdReplacements);

    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.notification.deleteMany({ where: { tenantId } });
    await tx.tenantInvitation.deleteMany({ where: { tenantId } });
    await tx.authSession.deleteMany({ where: { tenantId } });
    await tx.jobEvidence.deleteMany({ where: { tenantId } });
    await tx.jobCompletionReview.deleteMany({ where: { tenantId } });
    await tx.jobStatusHistory.deleteMany({ where: { tenantId } });
    await tx.job.deleteMany({ where: { tenantId } });
    await tx.customer.deleteMany({ where: { tenantId } });
    await tx.membership.deleteMany({ where: { tenantId } });

    await tx.tenant.upsert({
      where: { id: tenantId },
      create: data.tenant,
      update: {
        name: data.tenant.name,
        slug: data.tenant.slug,
        status: data.tenant.status,
        deletedAt: null,
      },
    });

    for (const user of data.users) {
      await tx.user.upsert({
        where: { id: user.id },
        create: user,
        update: {
          email: user.email,
          passwordHash: user.passwordHash,
          displayName: user.displayName,
          isActive: true,
        },
      });
    }

    await tx.membership.createMany({ data: data.memberships });
    await tx.customer.createMany({ data: data.customers });
    await tx.job.createMany({ data: data.jobs });
    await tx.jobStatusHistory.createMany({ data: data.statusHistory });
    await tx.jobCompletionReview.createMany({ data: data.completionReviews });
    await tx.auditLog.createMany({ data: data.auditLogs });

    seededData = data;
  });

  console.log("Production demo reset complete: Acme Home Services demo tenant refreshed.");
  if (!seededData) {
    throw new Error("Production demo reset did not produce seed data.");
  }
  printDemoSeedSummary(seededData);
}

main()
  .catch((error) => {
    console.error("Production demo reset failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
