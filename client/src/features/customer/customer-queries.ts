"use client";

import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import type {
  CreateCustomerInput,
  CustomerDetail,
  CustomerListItem,
  CustomerListQuery,
  UpdateCustomerInput,
} from "@/types/customer";
import {
  archiveCustomerRequest,
  createCustomerRequest,
  getCustomerDetailRequest,
  listCustomersRequest,
  restoreCustomerRequest,
  updateCustomerRequest,
} from "./customer-api";

type CustomerQueryOptions = {
  enabled?: boolean;
};

type UpdateCustomerVariables = {
  customerId: string;
  input: UpdateCustomerInput;
};

function updateCustomerDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: QueryScope,
  customer: CustomerListItem,
) {
  queryClient.setQueryData<CustomerDetail>(
    queryKeys.customers.detail(scope, customer.id),
    (current) => (current ? { ...current, ...customer } : current),
  );
}

async function invalidateCustomerDependencies(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: QueryScope,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists(scope) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all(scope) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(scope) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity.all(scope) }),
  ]);
}

export function useCustomersQuery(
  query: CustomerListQuery,
  options: CustomerQueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.customers.list(scope, query),
    queryFn: (accessToken) => listCustomersRequest(accessToken, query),
    enabled: options.enabled !== false && Boolean(scope.tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerDetailQuery(
  customerId: string,
  options: CustomerQueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.customers.detail(scope, customerId),
    queryFn: (accessToken) => getCustomerDetailRequest(accessToken, customerId),
    enabled:
      Boolean(scope.tenantId && customerId) && options.enabled !== false,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, input: CreateCustomerInput) =>
      createCustomerRequest(accessToken, input),
    onSuccess: async () => {
      await invalidateCustomerDependencies(queryClient, scope);
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, variables: UpdateCustomerVariables) =>
      updateCustomerRequest(
        accessToken,
        variables.customerId,
        variables.input,
      ),
    onSuccess: async (customer) => {
      updateCustomerDetail(queryClient, scope, customer);
      await invalidateCustomerDependencies(queryClient, scope);
    },
  });
}

export function useArchiveCustomerMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, customerId: string) =>
      archiveCustomerRequest(accessToken, customerId),
    onSuccess: async (customer) => {
      updateCustomerDetail(queryClient, scope, customer);
      await invalidateCustomerDependencies(queryClient, scope);
    },
  });
}

export function useRestoreCustomerMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, customerId: string) =>
      restoreCustomerRequest(accessToken, customerId),
    onSuccess: async (customer) => {
      updateCustomerDetail(queryClient, scope, customer);
      await invalidateCustomerDependencies(queryClient, scope);
    },
  });
}
