import { apiClient, type ApiSuccessResponse } from "@/lib/api-client";
import type {
  CreateCustomerInput,
  CustomerDetail,
  CustomerListItem,
  CustomerListQuery,
  PaginationMeta,
  UpdateCustomerInput,
} from "@/types/customer";

function requireData<T>(response: ApiSuccessResponse<T>, fallbackMessage: string) {
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

function authHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function buildCustomerQuery(query: CustomerListQuery) {
  const params = new URLSearchParams();

  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listCustomersRequest(
  accessToken: string,
  query: CustomerListQuery,
) {
  const response = await apiClient.get<ApiSuccessResponse<CustomerListItem[]>>(
    `/customers${buildCustomerQuery(query)}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Customer list response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)?.pagination ??
      {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        total: 0,
        totalPages: 1,
      }) satisfies PaginationMeta,
  };
}

export async function createCustomerRequest(
  accessToken: string,
  input: CreateCustomerInput,
) {
  const response = await apiClient.post<ApiSuccessResponse<CustomerListItem>>(
    "/customers",
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Create customer response is missing payload.");
}

export async function getCustomerDetailRequest(
  accessToken: string,
  customerId: string,
) {
  const response = await apiClient.get<ApiSuccessResponse<CustomerDetail>>(
    `/customers/${customerId}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Customer detail response is missing payload.");
}

export async function updateCustomerRequest(
  accessToken: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const response = await apiClient.patch<ApiSuccessResponse<CustomerListItem>>(
    `/customers/${customerId}`,
    input,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Update customer response is missing payload.");
}
