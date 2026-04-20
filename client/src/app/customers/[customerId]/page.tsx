"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerNotesCard } from "@/components/customer/customer-notes-card";
import { AppShell } from "@/components/ui/app-shell";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  surfaceClassName,
  strongSurfaceClassName,
} from "@/components/ui/styles";
import { getCustomerDetailRequest } from "@/features/customer/customer-api";
import { formatDateTime, formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail, CustomerJobSummary } from "@/types/customer";
import type { JobStatus } from "@/types/job";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function initialsFor(name: string | undefined | null) {
  if (!name) {
    return "OF";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatStatusLabel(status: JobStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "In progress";
    case "PENDING_REVIEW":
      return "Pending review";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

function isOpenJob(job: CustomerJobSummary) {
  return job.status !== "COMPLETED" && job.status !== "CANCELLED";
}

function DetailCard({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(surfaceClassName, className?.includes("p-0") ? "p-0" : "p-4", className)}>
      {eyebrow || title ? (
        <div className="mb-3 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-base font-bold text-[var(--color-text)]">{title}</h2>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-app-border)] py-1.5 last:border-b-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span
        className={cn(
          "max-w-[62%] text-right text-sm font-semibold text-[var(--color-text)]",
          mono && "font-mono text-xs",
        )}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  meta,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  tone?: "default" | "brand" | "success";
}) {
  return (
    <div className={`${surfaceClassName} p-3.5`}>
      <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
        {label}
      </p>
      <div
        className={cn(
          "mt-2 text-2xl font-extrabold",
          tone === "brand" && "text-[var(--color-brand)]",
          tone === "success" && "text-[var(--color-success)]",
          tone === "default" && "text-[var(--color-text)]",
        )}
      >
        {value}
      </div>
      {meta ? (
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{meta}</p>
      ) : null}
    </div>
  );
}

function JobHistoryCard({ jobs }: { jobs: CustomerJobSummary[] }) {
  return (
    <section className={`${surfaceClassName} overflow-hidden p-0`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-app-border)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
            Job history
          </p>
          <h2 className="mt-1 text-base font-bold text-[var(--color-text)]">Recent jobs</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-brand-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--color-brand)]">
            {jobs.length}
          </span>
          <Link href="/jobs" className={secondaryButtonClassName}>
            View all
          </Link>
        </div>
      </div>

      {jobs.length ? (
        <div className="divide-y divide-[var(--color-app-border)]">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="grid gap-3 px-5 py-4 transition hover:bg-[var(--color-app-panel-muted)] md:grid-cols-[minmax(0,1.2fr)_auto_minmax(150px,0.8fr)_minmax(120px,0.7fr)] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--color-brand)]">
                  {job.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {formatStatusLabel(job.status)}
                </p>
              </div>
              <StatusBadge kind="job" value={job.status} />
              <p className="font-mono text-xs text-[var(--color-text-secondary)]">
                {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
              </p>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {job.assignedToName ?? "Unassigned"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-5 text-sm leading-6 text-[var(--color-text-secondary)]">
          No jobs have been linked to this customer yet.
        </p>
      )}
    </section>
  );
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
    <AppShell title="Customer detail">
      <AuthGuard>
        {isLoading ? <LoadingPanel label="Loading customer..." /> : null}
        {error ? <InlineErrorBanner message={error} /> : null}

        {customer ? (
          <div className="space-y-4">
            <section className={`${strongSurfaceClassName} p-4`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-sm font-bold text-[var(--color-brand)]">
                    {initialsFor(customer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                      Customer #{customer.id}
                    </p>
                    <h1 className="mt-1 truncate text-2xl font-extrabold text-[var(--color-text)]">
                      {customer.name}
                    </h1>
                    <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                      {customer.email ?? "No email"} | {customer.phone ?? "No phone"}
                    </p>
                  </div>
                </div>

                {canManageCustomers(currentTenant?.role) ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/jobs/new?customerId=${customer.id}`}
                      className={secondaryButtonClassName}
                    >
                      Create job
                    </Link>
                    <Link
                      href={`/customers/${customer.id}/edit`}
                      className={primaryButtonClassName}
                    >
                      Edit customer
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <OverviewMetric
                label="Total jobs"
                value={customer.jobs.length}
                meta="Linked work orders"
                tone="brand"
              />
              <OverviewMetric
                label="Open jobs"
                value={customer.jobs.filter(isOpenJob).length}
                meta="Not completed or cancelled"
                tone="success"
              />
              <OverviewMetric
                label="Customer since"
                value={formatDateTime(customer.createdAt)}
                meta={`Created by ${customer.createdBy.displayName}`}
              />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                <JobHistoryCard jobs={customer.jobs} />
              </div>

              <aside className="space-y-4">
                <DetailCard eyebrow="Contact" title="Contact information">
                  <InfoRow label="Phone" value={customer.phone ?? "-"} />
                  <InfoRow label="Email" value={customer.email ?? "-"} />
                  <InfoRow label="Address" value={customer.address ?? "-"} />
                  <InfoRow label="Updated" value={formatDateTime(customer.updatedAt)} mono />
                </DetailCard>

                <CustomerNotesCard
                  customer={customer}
                  onCustomerChange={setCustomer}
                />
              </aside>
            </div>
          </div>
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
