"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  TodaysScheduleCard,
  type ScheduleItem,
} from "@/components/dashboard/todays-schedule-card";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Sparkles,
  Users,
} from "@/components/ui/icons";
import { AppShell } from "@/components/ui/app-shell";
import { StatCard } from "@/components/ui/info-cards";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  badgeBaseClassName,
  cn,
  secondaryButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { useDashboardSummaryQuery } from "@/features/dashboard/dashboard-queries";
import { formatTimeRange } from "@/features/job";
import { getApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function todaySummaryQuery() {
  const now = new Date();

  return {
    date: localDateString(now),
    timezoneOffsetMinutes: now.getTimezoneOffset(),
  };
}

function formatLastUpdated(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DashboardPage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const user = useAuthStore((state) => state.user);

  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
  });
  const summaryQueryInput = useMemo(() => todaySummaryQuery(), []);
  const summaryQuery = useDashboardSummaryQuery(summaryQueryInput);
  const summary = summaryQuery.data;
  const isSummaryLoading = !summary && summaryQuery.isPending;
  const summaryError = summaryQuery.error
    ? getApiErrorView(
        summaryQuery.error,
        "We couldn't load today's dashboard data.",
      )
    : null;
  const allowPlanner = currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  const scheduleItems = useMemo<ScheduleItem[]>(
    () => {
      if (!summary) {
        return [];
      }

      return summary.schedulePreview.map((item) => ({
        id: item.id,
        customerName: item.customerName,
        customerInitials: item.customerInitials || initialsFor(item.customerName),
        serviceAddress: item.serviceAddress,
        jobType: item.jobType,
        status: item.status,
        time: formatTimeRange(item.scheduledStartAt, item.scheduledEndAt),
        assignee: item.assignee,
      }));
    },
    [summary],
  );

  const retrySummary = () => {
    void summaryQuery.refetch();
  };

  return (
    <AppShell
      title="Dashboard"
      description="Daily dispatch context, schedule movement, and AI-assisted planning."
    >
      <AuthGuard>
        {!summary && summaryQuery.isError ? (
          <section
            role="alert"
            className={`${surfaceClassName} border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-6 py-8 sm:px-8`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-danger)]">
              Live data unavailable
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">
              Dashboard unavailable
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {summaryError?.message ?? "We couldn't load today's dashboard data."}
              <span className="mt-1 block">No metrics have been substituted.</span>
            </p>
            {summaryError?.requestId ? (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Request ID: <span className="font-mono">{summaryError.requestId}</span>
              </p>
            ) : null}
            <button
              type="button"
              className={`${secondaryButtonClassName} mt-5`}
              onClick={retrySummary}
              disabled={summaryQuery.isFetching}
            >
              {summaryQuery.isFetching ? "Retrying..." : "Try again"}
            </button>
          </section>
        ) : (
          <>
            {summary && summaryQuery.isError ? (
              <section
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-[var(--color-danger)]">
                    Dashboard couldn&apos;t refresh
                  </p>
                  <p className="mt-1 text-[var(--color-text-secondary)]">
                    Showing the last successful data from{" "}
                    {formatLastUpdated(summary.generatedAt)}.
                  </p>
                  {summaryError?.requestId ? (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Request ID: <span className="font-mono">{summaryError.requestId}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={retrySummary}
                  disabled={summaryQuery.isFetching}
                >
                  {summaryQuery.isFetching ? "Retrying..." : "Retry"}
                </button>
              </section>
            ) : null}

        <section className="relative overflow-hidden rounded-lg bg-[image:var(--gradient-brand)] px-7 py-6 text-white shadow-[0_18px_44px_-28px_var(--color-brand-glow)] sm:px-8">
          <div className="pointer-events-none absolute -right-7 -top-8 h-[128px] w-[128px] rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-24 h-[92px] w-[92px] rounded-full bg-white/10 opacity-60" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.12)_100%)]" />
          <div className="relative">
            <p className="text-sm font-medium text-white/80">
              {greeting}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-white sm:text-2xl">
              {summary
                ? `You have ${summary.metrics.todayJobs} ${summary.metrics.todayJobs === 1 ? "job" : "jobs"} scheduled today`
                : "Loading today's board..."}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              {summary
                ? `${summary.metrics.assignedJobs} assigned · ${summary.metrics.pendingReview} pending review · ${summary.metrics.unassignedJobs === 0 ? "All crew on track" : `${summary.metrics.unassignedJobs} unassigned`}`
                : "Fetching live dispatch, review, and crew status."}
            </p>
            {summary ? (
              <p className="mt-3 text-xs font-medium text-white/70">
                <time dateTime={summary.generatedAt}>
                  Last updated {formatLastUpdated(summary.generatedAt)}
                </time>
                {summaryQuery.isFetching ? " · Refreshing..." : null}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today Jobs"
            value={summary ? String(summary.metrics.todayJobs) : "—"}
            icon={<Briefcase className="h-[18px] w-[18px]" />}
            tone="brand"
            meta={summary ? "Visible on board" : "Loading live data"}
          />
          <StatCard
            label="Scheduled Rows"
            value={summary ? String(summary.metrics.scheduledRows) : "—"}
            icon={<Calendar className="h-[18px] w-[18px]" />}
            tone="indigo"
            meta={summary ? "Loaded for today" : "Loading live data"}
          />
          <StatCard
            label="Pending Review"
            value={summary ? String(summary.metrics.pendingReview) : "—"}
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            tone="warning"
            meta={summary ? "Needs manager action" : "Loading live data"}
          />
          <StatCard
            label="Active Crew"
            value={
              summary
                ? `${summary.metrics.activeCrewScheduled} / ${summary.metrics.activeCrewTotal}`
                : "—"
            }
            icon={<Users className="h-[18px] w-[18px]" />}
            tone="success"
            meta={
              summary
                ? `${summary.metrics.unassignedJobs} unassigned`
                : "Loading live data"
            }
          />
        </section>

        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TodaysScheduleCard items={scheduleItems} loading={isSummaryLoading} />
          <section className={`${surfaceClassName} overflow-hidden p-0`}>
            <div className="border-b border-[var(--color-app-border)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-[var(--color-text)]">Needs attention</h2>
                <span
                  className={cn(
                    badgeBaseClassName,
                    "border-[var(--color-app-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
                  )}
                >
                  {summary?.metrics.needsAttention ?? "—"}
                </span>
              </div>
            </div>

            <div className="space-y-1 p-2">
              {isSummaryLoading || !summary ? (
                <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">Checking today&apos;s board...</p>
              ) : summary.attentionItems.length === 0 ? (
                <div className="px-3 py-6 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text)]">All clear</p>
                  <p className="mt-1 leading-6">No pending review, new, or unassigned jobs in today&apos;s loaded board.</p>
                </div>
              ) : (
                summary.attentionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/jobs/${item.id}`}
                    className="block rounded-lg px-3 py-3 transition hover:bg-[var(--color-app-panel-muted)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                          {item.customer} · {item.assignee ?? "Unassigned"}
                        </p>
                      </div>
                      <StatusBadge kind="job" value={item.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>

            {allowPlanner ? (
              <div className="border-t border-[var(--color-app-border)] p-3">
                <Link href="/agent" className={`${secondaryButtonClassName} w-full justify-center`}>
                  <Sparkles className="h-4 w-4" />
                  Plan with AI
                </Link>
              </div>
            ) : null}
          </section>
        </div>
          </>
        )}
      </AuthGuard>
    </AppShell>
  );
}
