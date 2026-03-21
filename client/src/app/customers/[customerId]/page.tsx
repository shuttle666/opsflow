"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { DetailLayout } from "@/components/ui/detail-layout";
import { ActionCard, MetaCard, SummaryCard } from "@/components/ui/info-cards";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/styles";
import { getCustomerDetailRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail } from "@/types/customer";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

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
          <Link href={`/customers/${customer.id}/edit`} className={primaryButtonClassName}>
            Edit customer
          </Link>
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
                  eyebrow="Customer profile"
                  title="Contact profile"
                  description="Customer details that anchor future work orders and service history."
                >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/75 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Contact
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>Phone: {customer.phone ?? "-"}</p>
                      <p>Email: {customer.email ?? "-"}</p>
                      <p>Address: {customer.address ?? "-"}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/75 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Service notes
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-500">
                      Use this customer profile as the stable anchor for new jobs, dispatch actions, and future service history.
                    </p>
                  </div>
                </div>
                </SummaryCard>

                <SummaryCard
                  eyebrow="Related jobs"
                  title="Recent jobs"
                  description="A read-only preview of the most recent jobs connected to this customer."
                >
                  {customer.jobs.length ? (
                    <div className="space-y-3">
                      {customer.jobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-[24px] border border-white/75 bg-white p-4 text-sm text-slate-700 shadow-sm"
                        >
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-semibold text-slate-900 transition hover:text-cyan-700"
                          >
                            {job.title}
                          </Link>
                          <div className="mt-2">
                            <StatusBadge kind="job" value={job.status} />
                          </div>
                          <p className="mt-2">
                            Scheduled: {job.scheduledAt ? formatDateTime(job.scheduledAt) : "-"}
                          </p>
                          <p>Assigned to: {job.assignedToName ?? "-"}</p>
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
              <>
                <ActionCard
                  eyebrow="Actions"
                  title="Customer actions"
                  description="Open related work from this customer record."
                >
                  <div className="flex flex-col gap-3">
                    {canManageCustomers(currentTenant?.role) ? (
                      <Link
                        href={`/jobs/new?customerId=${customer.id}`}
                        className={secondaryButtonClassName}
                      >
                        Create job for this customer
                      </Link>
                    ) : null}
                  </div>
                </ActionCard>

                <MetaCard
                  eyebrow="Metadata"
                  title="Record details"
                  description="Audit-friendly context for this customer record."
                >
                  <div className="space-y-3 text-sm text-slate-700">
                    <p>Created by: {customer.createdBy.displayName}</p>
                    <p>Creator email: {customer.createdBy.email}</p>
                    <p>Created at: {formatDateTime(customer.createdAt)}</p>
                    <p>Updated at: {formatDateTime(customer.updatedAt)}</p>
                  </div>
                </MetaCard>

              </>
            }
          />
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
