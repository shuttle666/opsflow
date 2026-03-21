"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobForm } from "@/components/job/job-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { secondaryButtonClassName } from "@/components/ui/styles";
import { getCustomerDetailRequest, listCustomersRequest } from "@/features/customer/customer-api";
import { createJobRequest } from "@/features/job/job-api";
import type { JobFormValues } from "@/features/job/job-schema";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem } from "@/types/customer";

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function toApiScheduledAt(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed).toISOString() : "";
}

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCustomerId =
    searchParams.get("customerId") && searchParams.get("customerId")?.trim()
      ? searchParams.get("customerId")!.trim()
      : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [defaultValues, setDefaultValues] = useState<JobFormValues>({
    customerId: selectedCustomerId,
    title: "",
    description: "",
    scheduledAt: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const customerList = await withAccessTokenRetry((accessToken) =>
          listCustomersRequest(accessToken, {
            page: 1,
            pageSize: 50,
            sort: "name_asc",
          }),
        );

        let items = customerList.items;

        if (selectedCustomerId && !items.some((customer) => customer.id === selectedCustomerId)) {
          const selected = await withAccessTokenRetry((accessToken) =>
            getCustomerDetailRequest(accessToken, selectedCustomerId),
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
          setDefaultValues((current) => ({
            ...current,
            customerId: selectedCustomerId || current.customerId,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load customers.",
          );
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
  }, [selectedCustomerId, withAccessTokenRetry]);

  return (
    <AppShell
      title="Create Job"
    >
      <AuthGuard>
        {!canManageJobs(currentTenant?.role) ? (
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
                  setSubmitError(null);

                  try {
                    const created = await withAccessTokenRetry((accessToken) =>
                      createJobRequest(accessToken, {
                        customerId: values.customerId,
                        title: values.title,
                        description: values.description,
                        scheduledAt: toApiScheduledAt(values.scheduledAt),
                      }),
                    );
                    router.push(`/jobs/${created.id}`);
                  } catch (error) {
                    setSubmitError(
                      error instanceof Error ? error.message : "Failed to create job.",
                    );
                  }
                }}
              />
            ) : (
              <div className="space-y-4 text-sm text-slate-600">
                <p>No customers are available yet. Create a customer before opening a job.</p>
                <Link
                  href="/customers/new"
                  className={secondaryButtonClassName}
                >
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
