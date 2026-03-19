import { prisma } from "../../src/lib/prisma";

export const runDbTests =
  process.env.RUN_DB_TESTS === "true" &&
  process.env.ALLOW_DB_TEST_RESET === "true";

export const describeIfDb = runDbTests ? describe : describe.skip;

export async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.tenantInvitation.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.jobStatusHistory.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}

