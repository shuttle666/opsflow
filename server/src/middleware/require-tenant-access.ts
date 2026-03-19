import type { NextFunction, Request, Response } from "express";
import { MembershipStatus, TenantStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthError } from "../modules/auth/auth-errors";

export async function requireTenantAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) {
      throw new AuthError("INVALID_CREDENTIALS", "Authentication is required.", 401);
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: req.auth.userId,
          tenantId: req.auth.tenantId,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new AuthError(
        "MEMBERSHIP_INACTIVE",
        "Membership is not active for this tenant.",
        403,
      );
    }

    if (
      membership.tenant.status !== TenantStatus.ACTIVE ||
      membership.tenant.deletedAt
    ) {
      throw new AuthError("TENANT_INACTIVE", "Tenant is inactive.", 403);
    }

    req.auth = {
      ...req.auth,
      role: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

