import { prisma } from "../../src/lib/prisma";
import {
  assertSafeDatabaseResetEnvironment,
  assertSafeTestDatabaseUrl,
} from "./database-safety";

const dbTestsRequested =
  process.env.RUN_DB_TESTS === "true" &&
  process.env.ALLOW_DB_TEST_RESET === "true";

if (dbTestsRequested) {
  assertSafeTestDatabaseUrl(process.env.DATABASE_URL);
}

export const runDbTests = dbTestsRequested;

export const describeIfDb = runDbTests ? describe : describe.skip;

export async function resetDatabase() {
  // Keep this assertion inside the destructive helper. `runDbTests` is a
  // module-load-time convenience for suite selection, but callers can invoke
  // this function later after the environment has changed.
  assertSafeDatabaseResetEnvironment(process.env);

  await prisma.toolInvocation.deleteMany();
  await prisma.agentToolCall.deleteMany();
  await prisma.agentProposal.deleteMany();
  await prisma.agentMessage.deleteMany();
  await prisma.agentConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.tenantInvitation.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.jobEvidence.deleteMany();
  await prisma.jobCompletionReview.deleteMany();
  await prisma.jobStatusHistory.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}
