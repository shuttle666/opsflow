import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { activityListQuerySchema } from "./audit-schemas";
import { listActivityFeed } from "./audit.service";

export const listActivityFeedHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = activityListQuerySchema.parse(req.query);
  const result = await listActivityFeed(req.auth, query);

  sendSuccess(res, {
    message: "Activity loaded.",
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
});
