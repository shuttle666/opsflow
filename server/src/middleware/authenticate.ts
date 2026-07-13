import type { NextFunction, Request, Response } from "express";
import { AuthError } from "../modules/auth/auth-errors";
import { resolveAuthContextFromAccessToken } from "../modules/auth/auth-context";

function parseBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = parseBearerToken(req);

    if (!token) {
      throw new AuthError("INVALID_CREDENTIALS", "Missing access token.", 401);
    }

    req.auth = await resolveAuthContextFromAccessToken(token);

    next();
  } catch (error) {
    next(error);
  }
}
