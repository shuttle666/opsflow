"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobForm } from "@/components/job/job-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { useCustomerDetailQuery } from "@/features/customer/customer-queries";
import { toApiDateTime } from "@/features/job";
import { useCreateJobMutation } from "@/features/job/job-queries";
import type { JobFormValues } from "@/features/job/job-schema";
import { getApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCustomerId =
    searchParams.get("customerId") && searchParams.get("customerId")?.trim()
      ? searchParams.get("customerId")!.trim()
      : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const allowManage = canManageJobs(currentTenant?.role);
  const selectedCustomerQuery = useCustomerDetailQuery(selectedCustomerId, {
    enabled: allowManage && Boolean(selectedCustomerId),
  });
  const selectedCustomerError = selectedCustomerId
    ? selectedCustomerQuery.data?.archivedAt
      ? new Error("Archived customers cannot be used for new jobs.")
      : selectedCustomerQuery.error
    : null;
  const loadError = selectedCustomerError
    ? getApiErrorView(selectedCustomerError, "Failed to load selected customer.")
    : null;
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
    allowManage && Boolean(selectedCustomerId) && selectedCustomerQuery.isLoading;

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

            {!isLoading && !loadError ? (
                <JobForm
                  selectedCustomer={
                    selectedCustomerQuery.data
                      ? {
                          id: selectedCustomerQuery.data.id,
                          name: selectedCustomerQuery.data.name,
                        }
                      : null
                  }
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
