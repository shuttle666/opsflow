import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  assertSafeDevelopmentDatabaseUrl,
  buildDemoSeedData,
  demoSeedProfiles,
  printDemoSeedSummary,
} from "./demo-data";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://opsflow:opsflow@localhost:5432/opsflow";

assertSafeDevelopmentDatabaseUrl(connectionString);

const pool = new Pool({
  connectionString,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const data = buildDemoSeedData(demoSeedProfiles.developmentLarge);

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.tenantInvitation.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.jobEvidence.deleteMany(),
    prisma.jobCompletionReview.deleteMany(),
    prisma.jobStatusHistory.deleteMany(),
    prisma.job.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.tenant.create({ data: data.tenant });
  await prisma.user.createMany({ data: data.users });
  await prisma.membership.createMany({ data: data.memberships });
  await prisma.customer.createMany({ data: data.customers });
  await prisma.job.createMany({ data: data.jobs });
  await prisma.jobStatusHistory.createMany({ data: data.statusHistory });
  await prisma.jobCompletionReview.createMany({ data: data.completionReviews });
  await prisma.auditLog.createMany({ data: data.auditLogs });

  console.log("Seed complete: Acme Home Services development demo data inserted.");
  printDemoSeedSummary(data);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
