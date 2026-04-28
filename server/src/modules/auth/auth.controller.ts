import type { RequestHandler } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationIdParamSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  switchTenantSchema,
  tenantInvitationListQuerySchema,
} from "./auth-schemas";
import {
  acceptTenantInvitationById,
  acceptTenantInvitation,
  cancelTenantInvitation,
  createTenantInvitation,
  getAuthMe,
  login,
  listMyInvitations,
  listTenantInvitations,
  logout,
  refreshSession,
  register,
  resendTenantInvitation,
  switchTenant,
} from "./auth.service";
import { getRequestMetadata } from "./request-metadata";

const refreshCookieName = "opsflow_refresh";
const refreshCookiePath = "/api/auth";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: refreshCookiePath,
    maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  };
}

function parseCookieHeader(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(";") ?? []) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    try {
      cookies.set(key, decodeURIComponent(value));
    } catch {
      cookies.set(key, value);
    }
  }

  return cookies;
}

function getRefreshCookie(req: Parameters<RequestHandler>[0]) {
  return parseCookieHeader(req.headers.cookie).get(refreshCookieName);
}

function setRefreshCookie(res: Parameters<RequestHandler>[1], refreshToken: string) {
  res.cookie(refreshCookieName, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Parameters<RequestHandler>[1]) {
  res.clearCookie(refreshCookieName, {
    path: refreshCookiePath,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

function publicAuthResult<T extends { refreshToken: string }>(result: T) {
  const { refreshToken: _refreshToken, ...publicResult } = result;
  return publicResult;
}

export const registerHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await register(input, getRequestMetadata(req));
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    statusCode: 201,
    message: "Registration successful.",
    data: publicAuthResult(result),
  });
});

export const loginHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await login(input, getRequestMetadata(req));
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    message: "Login successful.",
    data: publicAuthResult(result),
  });
});

export const refreshHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = refreshSchema.parse(req.body ?? {});
  const refreshToken = input.refreshToken ?? getRefreshCookie(req);
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is missing.");
  }

  const result = await refreshSession({ refreshToken }, getRequestMetadata(req));
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    message: "Token refresh successful.",
    data: publicAuthResult(result),
  });
});

export const logoutHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const input = logoutSchema.parse(req.body ?? {});
  await logout(req.auth, input, getRequestMetadata(req));
  clearRefreshCookie(res);

  sendSuccess(res, {
    message: "Logout successful.",
  });
});

export const meHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const result = await getAuthMe(req.auth);

  sendSuccess(res, {
    message: "Current user loaded.",
    data: result,
  });
});

export const switchTenantHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const input = switchTenantSchema.parse(req.body);
    const result = await switchTenant(req.auth, input, getRequestMetadata(req));
    setRefreshCookie(res, result.refreshToken);

    sendSuccess(res, {
      message: "Tenant switched successfully.",
      data: publicAuthResult(result),
    });
  },
);

export const createInvitationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const tenantId =
      typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    if (!tenantId) {
      throw new ApiError(400, "tenantId route parameter is required.");
    }

    const input = createInvitationSchema.parse(req.body);
    const result = await createTenantInvitation(
      req.auth,
      tenantId,
      input,
      getRequestMetadata(req),
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Invitation created.",
      data: result,
    });
  },
);

export const acceptInvitationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const input = acceptInvitationSchema.parse(req.body);
    const result = await acceptTenantInvitation(
      req.auth,
      input,
      getRequestMetadata(req),
    );

    sendSuccess(res, {
      message: "Invitation accepted.",
      data: result,
    });
  },
);

export const listMyInvitationsHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await listMyInvitations(req.auth);

    sendSuccess(res, {
      message: "My invitations loaded.",
      data: result,
    });
  },
);

export const acceptInvitationByIdHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const { invitationId } = invitationIdParamSchema.parse(req.params);
    const result = await acceptTenantInvitationById(
      req.auth,
      invitationId,
      getRequestMetadata(req),
    );

    sendSuccess(res, {
      message: "Invitation accepted.",
      data: result,
    });
  },
);

export const listTenantInvitationsHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const tenantId =
      typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    if (!tenantId) {
      throw new ApiError(400, "tenantId route parameter is required.");
    }

    const { status } = tenantInvitationListQuerySchema.parse(req.query);
    const result = await listTenantInvitations(req.auth, tenantId, status);

    sendSuccess(res, {
      message: "Tenant invitations loaded.",
      data: result,
    });
  },
);

export const resendTenantInvitationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const tenantId =
      typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    if (!tenantId) {
      throw new ApiError(400, "tenantId route parameter is required.");
    }

    const { invitationId } = invitationIdParamSchema.parse(req.params);
    const result = await resendTenantInvitation(
      req.auth,
      tenantId,
      invitationId,
      getRequestMetadata(req),
    );

    sendSuccess(res, {
      message: "Invitation resent.",
      data: result,
    });
  },
);

export const cancelTenantInvitationHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const tenantId =
      typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    if (!tenantId) {
      throw new ApiError(400, "tenantId route parameter is required.");
    }

    const { invitationId } = invitationIdParamSchema.parse(req.params);
    const result = await cancelTenantInvitation(
      req.auth,
      tenantId,
      invitationId,
      getRequestMetadata(req),
    );

    sendSuccess(res, {
      message: "Invitation cancelled.",
      data: result,
    });
  },
);
