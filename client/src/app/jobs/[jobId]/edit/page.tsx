"use client";

import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobForm } from "@/components/job/job-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { getCustomerDetailRequest, listCustomersRequest } from "@/features/customer/customer-api";
import { toApiDateTime, toDateTimeLocal } from "@/features/job";
import {
  useJobDetailQuery,
  useUpdateJobMutation,
} from "@/features/job/job-queries";
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

export default function EditJobPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const queryScope = useAuthenticatedQueryScope();
  const allowManage = canManageJobs(currentTenant?.role);
  const jobQuery = useJobDetailQuery(jobId, {
    enabled: allowManage && Boolean(jobId),
  });
  const customersQuery = useAuthenticatedQuery({
    queryKey: queryKeys.customers.list(queryScope, customerListQuery),
    queryFn: (accessToken) =>
      listCustomersRequest(accessToken, customerListQuery),
    enabled: allowManage && Boolean(queryScope.tenantId && jobId),
  });
  const listedCustomers = customersQuery.data?.items ?? [];
  const jobCustomerId = jobQuery.data?.customer.id ?? "";
  const needsJobCustomer = Boolean(
    jobCustomerId &&
      customersQuery.isSuccess &&
      !listedCustomers.some((customer) => customer.id === jobCustomerId),
  );
  const selectedCustomerQuery = useAuthenticatedQuery({
    queryKey: queryKeys.customers.detail(queryScope, jobCustomerId),
    queryFn: (accessToken) =>
      getCustomerDetailRequest(accessToken, jobCustomerId),
    enabled:
      allowManage &&
      Boolean(queryScope.tenantId) &&
      needsJobCustomer,
  });
  const queryError =
    jobQuery.error ??
    customersQuery.error ??
    (needsJobCustomer ? selectedCustomerQuery.error : null);
  const loadError = !jobId
    ? "Job id is missing."
    : queryError
      ? getApiErrorView(queryError, "Failed to load job.")
      : null;
  const customers: CustomerListItem[] = loadError
    ? []
    : needsJobCustomer && selectedCustomerQuery.data
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
  const hasLoadedFormData = Boolean(
    jobQuery.data &&
      customersQuery.data &&
      (!needsJobCustomer || selectedCustomerQuery.data) &&
      !loadError,
  );
  const defaultValues: JobFormValues | null =
    jobQuery.data && hasLoadedFormData
      ? {
          customerId: jobQuery.data.customer.id,
          title: jobQuery.data.title,
          serviceAddress: jobQuery.data.serviceAddress,
          description: jobQuery.data.description ?? "",
          scheduledStartAt: toDateTimeLocal(jobQuery.data.scheduledStartAt),
          scheduledEndAt: toDateTimeLocal(jobQuery.data.scheduledEndAt),
        }
      : null;
  const isLoading =
    allowManage &&
    Boolean(jobId) &&
    (jobQuery.isLoading ||
      customersQuery.isLoading ||
      (needsJobCustomer && selectedCustomerQuery.isLoading));
  const updateJobMutation = useUpdateJobMutation();
  const submitError = updateJobMutation.error
    ? getApiErrorView(updateJobMutation.error, "Failed to update job.")
    : null;

  return (
    <AppShell
      title="Edit Job"
    >
      <AuthGuard>
        {!allowManage ? (
          <EmptyStatePanel
            title="Job editing is unavailable"
            description="Your current role cannot edit jobs in this workspace."
          />
        ) : (
          <FormSurface
            eyebrow="Job"
            title="Edit job"
            description="Update customer linkage, title, description, and scheduled time without changing workflow state."
          >
            {isLoading ? <LoadingPanel label="Loading job..." /> : null}
            {loadError ? <InlineErrorBanner message={loadError} /> : null}

            {defaultValues ? (
              <JobForm
                customers={customers}
                defaultValues={defaultValues}
                submitLabel="Save changes"
                submittingLabel="Saving changes..."
                submitError={submitError}
                onSubmit={async (values) => {
                  try {
                    await updateJobMutation.mutateAsync({
                      jobId,
                      input: {
                        customerId: values.customerId,
                        title: values.title,
                        serviceAddress: values.serviceAddress,
                        description: values.description,
                        scheduledStartAt: toApiDateTime(values.scheduledStartAt),
                        scheduledEndAt: toApiDateTime(values.scheduledEndAt),
                      },
                    });
                    router.push(`/jobs/${jobId}`);
                  } catch {
                    // The mutation exposes the API error to the form.
                  }
                }}
              />
            ) : null}
          </FormSurface>
        )}
      </AuthGuard>
    </AppShell>
  );
}
