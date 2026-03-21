"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobForm } from "@/components/job/job-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { getCustomerDetailRequest, listCustomersRequest } from "@/features/customer/customer-api";
import { getJobDetailRequest, updateJobRequest } from "@/features/job/job-api";
import type { JobFormValues } from "@/features/job/job-schema";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem } from "@/types/customer";

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toApiScheduledAt(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed).toISOString() : "";
}

export default function EditJobPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [defaultValues, setDefaultValues] = useState<JobFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!jobId) {
      setLoadError("Job id is missing.");
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [job, customerList] = await Promise.all([
          withAccessTokenRetry((accessToken) => getJobDetailRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) =>
            listCustomersRequest(accessToken, {
              page: 1,
              pageSize: 50,
              sort: "name_asc",
            }),
          ),
        ]);

        let items = customerList.items;
        if (!items.some((customer) => customer.id === job.customer.id)) {
          const selected = await withAccessTokenRetry((accessToken) =>
            getCustomerDetailRequest(accessToken, job.customer.id),
          );
          items = [
            ...items,
            {
              id: selected.id,
              name: selected.name,
              phone: selected.phone ?? null,
              email: selected.email ?? null,
              address: selected.address ?? null,
              createdAt: selected.createdAt,
              updatedAt: selected.updatedAt,
            },
          ];
        }

        if (!cancelled) {
          setCustomers(items);
          setDefaultValues({
            customerId: job.customer.id,
            title: job.title,
            description: job.description ?? "",
            scheduledAt: toDateTimeLocal(job.scheduledAt),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load job.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, withAccessTokenRetry]);

  return (
    <AppShell
      title="Edit Job"
    >
      <AuthGuard>
        {!canManageJobs(currentTenant?.role) ? (
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
                setSubmitError(null);

                try {
                  await withAccessTokenRetry((accessToken) =>
                    updateJobRequest(accessToken, jobId, {
                      customerId: values.customerId,
                      title: values.title,
                      description: values.description,
                      scheduledAt: toApiScheduledAt(values.scheduledAt),
                    }),
                  );
                  router.push(`/jobs/${jobId}`);
                } catch (error) {
                  setSubmitError(
                    error instanceof Error ? error.message : "Failed to update job.",
                    );
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
