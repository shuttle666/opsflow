"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobForm } from "@/components/job/job-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { secondaryButtonClassName } from "@/components/ui/styles";
import { getCustomerDetailRequest, listCustomersRequest } from "@/features/customer/customer-api";
import { toApiDateTime } from "@/features/job";
import { useCreateJobMutation } from "@/features/job/job-queries";
import type { JobFormValues } from "@/features/job/job-schema";
import {
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { getApiErrorView } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem } from "@/types/customer";

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

const customerListQuery = {
  page: 1,
  pageSize: 50,
  sort: "name_asc" as const,
};

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCustomerId =
    searchParams.get("customerId") && searchParams.get("customerId")?.trim()
      ? searchParams.get("customerId")!.trim()
      : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const queryScope = useAuthenticatedQueryScope();
  const allowManage = canManageJobs(currentTenant?.role);
  const customersQuery = useAuthenticatedQuery({
    queryKey: queryKeys.customers.list(queryScope, customerListQuery),
    queryFn: (accessToken) =>
      listCustomersRequest(accessToken, customerListQuery),
    enabled: allowManage && Boolean(queryScope.tenantId),
  });
  const listedCustomers = customersQuery.data?.items ?? [];
  const selectedCustomerIsListed = listedCustomers.some(
    (customer) => customer.id === selectedCustomerId,
  );
  const needsSelectedCustomer = Boolean(
    selectedCustomerId &&
      customersQuery.isSuccess &&
      !selectedCustomerIsListed,
  );
  const selectedCustomerQuery = useAuthenticatedQuery({
    queryKey: queryKeys.customers.detail(queryScope, selectedCustomerId),
    queryFn: (accessToken) =>
      getCustomerDetailRequest(accessToken, selectedCustomerId),
    enabled:
      allowManage &&
      Boolean(queryScope.tenantId) &&
      needsSelectedCustomer,
  });
  const selectedCustomerError = needsSelectedCustomer
    ? selectedCustomerQuery.data?.archivedAt
      ? new Error("Archived customers cannot be used for new jobs.")
      : selectedCustomerQuery.error
    : null;
  const queryError = customersQuery.error ?? selectedCustomerError;
  const loadError = queryError
    ? getApiErrorView(queryError, "Failed to load customers.")
    : null;
  const customers: CustomerListItem[] = loadError
    ? []
    : needsSelectedCustomer && selectedCustomerQuery.data
      ? [
          ...listedCustomers,
          {
            id: selectedCustomerQuery.data.id,
            name: selectedCustomerQuery.data.name,
            phone: selectedCustomerQuery.data.phone ?? null,
            email: selectedCustomerQuery.data.email ?? null,
            notes: selectedCustomerQuery.data.notes ?? null,
            archivedAt: selectedCustomerQuery.data.archivedAt,
            createdAt: selectedCustomerQuery.data.createdAt,
            updatedAt: selectedCustomerQuery.data.updatedAt,
          },
        ]
      : listedCustomers;
  const defaultValues: JobFormValues = {
    customerId: selectedCustomerId,
    title: "",
    serviceAddress: "",
    description: "",
    scheduledStartAt: "",
    scheduledEndAt: "",
  };
  const createJobMutation = useCreateJobMutation();
  const submitError = createJobMutation.error
    ? getApiErrorView(createJobMutation.error, "Failed to create job.")
    : null;
  const isLoading =
    allowManage &&
    (customersQuery.isLoading ||
      (needsSelectedCustomer && selectedCustomerQuery.isLoading));

  return (
    <AppShell
      title="Create Job"
    >
      <AuthGuard>
        {!allowManage ? (
          <EmptyStatePanel
            title="Job creation is unavailable"
            description="Your current role cannot create job records in this workspace."
          />
        ) : (
          <FormSurface
            eyebrow="Job"
            title="New job"
            description="Every job belongs to a customer. Start with a clean record for scheduling and assignment."
          >
            {isLoading ? <LoadingPanel label="Loading customers..." /> : null}
            {loadError ? <InlineErrorBanner message={loadError} /> : null}

            {!isLoading ? (
              customers.length > 0 ? (
                <JobForm
                  customers={customers}
                  defaultValues={defaultValues}
                  submitLabel="Create job"
                  submittingLabel="Creating job..."
                  submitError={submitError}
                  onSubmit={async (values) => {
                    try {
                      const created = await createJobMutation.mutateAsync({
                          customerId: values.customerId,
                          title: values.title,
                          serviceAddress: values.serviceAddress,
                          description: values.description,
                          scheduledStartAt: toApiDateTime(values.scheduledStartAt),
                          scheduledEndAt: toApiDateTime(values.scheduledEndAt),
                        });
                      router.push(`/jobs/${created.id}`);
                    } catch {
                      // The mutation exposes the API error to the form.
                    }
                  }}
                />
              ) : (
                <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
                  <p>No customers are available yet. Create a customer before opening a job.</p>
                  <Link href="/customers/new" className={secondaryButtonClassName}>
                    Create customer first
                  </Link>
                </div>
              )
            ) : null}
          </FormSurface>
        )}
      </AuthGuard>
    </AppShell>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={null}>
      <NewJobPageContent />
    </Suspense>
  );
}
