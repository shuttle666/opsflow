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

const transactionOptions = {
  maxWait: 30_000,
  timeout: 120_000,
};
const maxResetAttempts = 3;

function isTransactionStartTimeout(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };

  return (
    maybeError.code === "P2028" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("Unable to start a transaction")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function resetProductionDemoData() {
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
  }, transactionOptions);

  if (!seededData) {
    throw new Error("Production demo reset did not produce seed data.");
  }

  return seededData;
}

async function resetProductionDemoDataWithRetry() {
  for (let attempt = 1; attempt <= maxResetAttempts; attempt += 1) {
    try {
      return await resetProductionDemoData();
    } catch (error) {
      const canRetry = attempt < maxResetAttempts && isTransactionStartTimeout(error);

      if (!canRetry) {
        throw error;
      }

      const retryDelayMs = attempt * 5_000;
      console.warn(
        `Production demo reset could not start a transaction; retrying in ${retryDelayMs / 1000}s (${attempt}/${maxResetAttempts}).`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw new Error("Production demo reset exhausted retries.");
}

async function main() {
  const seededData = await resetProductionDemoDataWithRetry();

  console.log("Production demo reset complete: Acme Home Services demo tenant refreshed.");
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
