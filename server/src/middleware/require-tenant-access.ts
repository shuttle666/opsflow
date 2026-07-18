import type { NextFunction, Request, Response } from "express";
import { AuthError } from "../modules/auth/auth-errors";
import { revalidateTenantAuthContext } from "../modules/auth/auth-context";

export async function requireTenantAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) {
      throw new AuthError("INVALID_CREDENTIALS", "Authentication is required.", 401);
    }

    req.auth = await revalidateTenantAuthContext(req.auth);

    next();
  } catch (error) {
    next(error);
  }
}
