import type { RequestHandler } from "express";
import { env } from "../config/env";
import { sendSuccess } from "../utils/api-response";

export const getHealthStatus: RequestHandler = (_req, res) => {
  sendSuccess(res, {
    message: "OpsFlow API is healthy.",
    data: {
      status: "ok",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
};
