export type ApiMeta = Record<string, unknown>;

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data?: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  details?: unknown;
};
