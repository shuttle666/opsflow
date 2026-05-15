export type ApiMeta = Record<string, unknown>;

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data?: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};
