import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { dashboardSummaryQuerySchema } from "./dashboard-schemas";
import { getDashboardSummary } from "./dashboard.service";

export const getDashboardSummaryHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const query = dashboardSummaryQuerySchema.parse(req.query);
    const result = await getDashboardSummary(req.auth, query);

    sendSuccess(res, {
      message: "Dashboard summary loaded.",
      data: result,
    });
  },
);
