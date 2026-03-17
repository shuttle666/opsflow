import type { Response } from "express";
import type { ApiMeta, ApiSuccessResponse } from "../types/api";

type SendSuccessOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: ApiMeta;
};

export function sendSuccess<T>(
  res: Response<ApiSuccessResponse<T>>,
  options: SendSuccessOptions<T>,
) {
  const { statusCode = 200, message, data, meta } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    ...(meta ? { meta } : {}),
  });
}
