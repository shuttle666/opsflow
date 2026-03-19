import type { MembershipRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AuditAction } from "@prisma/client";
import { AuthError } from "../modules/auth/auth-errors";
import { createAuditLogSafe } from "../modules/audit/audit.service";

export function requireRole(...allowedRoles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AuthError("INVALID_CREDENTIALS", "Authentication is required.", 401));
      return;
    }

    if (allowedRoles.includes(req.auth.role)) {
      next();
      return;
    }

    createAuditLogSafe({
      action: AuditAction.RBAC_FORBIDDEN,
      tenantId: req.auth.tenantId,
      userId: req.auth.userId,
      targetType: "role_check",
      targetId: allowedRoles.join(","),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: {
        actualRole: req.auth.role,
        requiredRoles: allowedRoles,
      },
    });

    next(
      new AuthError(
        "FORBIDDEN_ROLE",
        "Your role does not have permission for this action.",
        403,
      ),
    );
  };
}

