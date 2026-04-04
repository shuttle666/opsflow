"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerNotesCard } from "@/components/customer/customer-notes-card";
import { AppShell } from "@/components/ui/app-shell";
import { DetailLayout } from "@/components/ui/detail-layout";
import { SummaryCard } from "@/components/ui/info-cards";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/styles";
import { getCustomerDetailRequest } from "@/features/customer/customer-api";
import { formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail } from "@/types/customer";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = typeof params.customerId === "string" ? params.customerId : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!customerId) {
      setError("Customer id is missing.");
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loaded = await withAccessTokenRetry((accessToken) =>
          getCustomerDetailRequest(accessToken, customerId),
        );

        if (!cancelled) {
          setCustomer(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load customer.",
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
  }, [customerId, withAccessTokenRetry]);

  return (
    <AppShell
      title={customer?.name ?? "Customer detail"}
      actions={
        customer && canManageCustomers(currentTenant?.role) ? (
          <div className="flex gap-2">
            <Link href={`/jobs/new?customerId=${customer.id}`} className={secondaryButtonClassName}>
              Create job
            </Link>
            <Link href={`/customers/${customer.id}/edit`} className={primaryButtonClassName}>
              Edit customer
            </Link>
          </div>
        ) : undefined
      }
    >
      <AuthGuard>
        {isLoading ? <LoadingPanel label="Loading customer..." /> : null}
        {error ? <InlineErrorBanner message={error} /> : null}

        {customer ? (
          <DetailLayout
            main={
              <>
                <SummaryCard
                  eyebrow="Overview"
                  title={customer.name}
                >
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>Phone: {customer.phone ?? "-"}</p>
                    <p>Email: {customer.email ?? "-"}</p>
                    <p>Address: {customer.address ?? "-"}</p>
                  </div>
                </SummaryCard>

                <SummaryCard
                  eyebrow="Related jobs"
                  title="Recent jobs"
                >
                  {customer.jobs.length ? (
                    <div className="space-y-3">
                      {customer.jobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-[24px] border border-white/75 bg-white p-4 text-sm text-slate-700 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-semibold text-slate-900 transition hover:text-cyan-700"
                            >
                              {job.title}
                            </Link>
                            <StatusBadge kind="job" value={job.status} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 text-slate-500">
                            <p>
                              Scheduled: {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                            </p>
                            <p>Assigned to: {job.assignedToName ?? "-"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No jobs have been linked to this customer yet.
                    </p>
                  )}
                </SummaryCard>
              </>
            }
            sidebar={
              <CustomerNotesCard
                customer={customer}
                onCustomerChange={setCustomer}
              />
            }
          />
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
