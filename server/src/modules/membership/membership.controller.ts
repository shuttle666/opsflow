import type { RequestHandler } from "express";
import { getRequestMetadata } from "../auth/request-metadata";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  membershipIdParamSchema,
  membershipListQuerySchema,
  updateMembershipSchema,
} from "./membership-schemas";
import { listMemberships, updateMembership } from "./membership.service";

export const listMembershipsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = membershipListQuerySchema.parse(req.query);
  const result = await listMemberships(req.auth, query);

  sendSuccess(res, {
    message: "Memberships loaded.",
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
});

export const updateMembershipHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { membershipId } = membershipIdParamSchema.parse(req.params);
  const input = updateMembershipSchema.parse(req.body);
  const result = await updateMembership(req.auth, membershipId, input, getRequestMetadata(req));

  sendSuccess(res, {
    message: "Membership updated.",
    data: result,
  });
});
