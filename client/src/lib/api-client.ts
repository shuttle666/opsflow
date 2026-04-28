type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  cache?: RequestCache;
  responseType?: "json" | "blob";
};

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, options: RequestOptions = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = new Headers(options.headers);

  if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    cache: options.cache ?? "no-store",
  });

  if (options.responseType === "blob") {
    if (!response.ok) {
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const payload = isJson ? await response.json().catch(() => undefined) : undefined;
      const errorPayload = payload as ApiErrorResponse | undefined;
      throw new ApiClientError(
        response.status,
        errorPayload?.message ?? `API request failed with status ${response.status}`,
        errorPayload?.details,
      );
    }

    return (await response.blob()) as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | undefined;
    throw new ApiClientError(
      response.status,
      errorPayload?.message ?? `API request failed with status ${response.status}`,
      errorPayload?.details,
    );
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  postForm: <T>(path: string, body: FormData, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
  getBlob: (path: string, options?: Omit<RequestOptions, "method" | "body" | "responseType">) =>
    request<Blob>(path, { ...options, method: "GET", responseType: "blob" }),
};
