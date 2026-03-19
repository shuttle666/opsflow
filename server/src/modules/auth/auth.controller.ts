import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  switchTenantSchema,
} from "./auth-schemas";
import {
  acceptTenantInvitation,
  createTenantInvitation,
  getAuthMe,
  login,
  logout,
  refreshSession,
  register,
  switchTenant,
} from "./auth.service";
import { getRequestMetadata } from "./request-metadata";

export const registerHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await register(input, getRequestMetadata(req));

  sendSuccess(res, {
    statusCode: 201,
    message: "Registration successful.",
    data: result,
  });
});

export const loginHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await login(input, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Login successful.",
    data: result,
  });
});

export const refreshHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = refreshSchema.parse(req.body);
  const result = await refreshSession(input, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Token refresh successful.",
    data: result,
  });
});

export const logoutHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const input = logoutSchema.parse(req.body ?? {});
  await logout(req.auth, input, getRequestMetadata(req));

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

    sendSuccess(res, {
      message: "Tenant switched successfully.",
      data: result,
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
