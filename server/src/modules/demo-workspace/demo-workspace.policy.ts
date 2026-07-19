import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

function demoAdministrationError() {
  return new ApiError(
    403,
    "This action is not available in a quick demo workspace.",
    "DEMO_ACTION_NOT_ALLOWED",
  );
}

export async function assertUserIsNotTemporaryDemoUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { demoWorkspaceId: true },
  });

  if (user?.demoWorkspaceId) {
    throw demoAdministrationError();
  }
}

export async function assertTenantIsNotDemoWorkspace(tenantId: string) {
  const workspace = await prisma.demoWorkspace.findUnique({
    where: { tenantId },
    select: { id: true },
  });

  if (workspace) {
    throw demoAdministrationError();
  }
}

export function throwDemoAdministrationError(): never {
  throw demoAdministrationError();
}
