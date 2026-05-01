"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { getDashboardSummaryRequest } from "@/features/dashboard";
import { formatTimeRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { DashboardSummary } from "@/types/dashboard";

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

function emptyDashboardSummary(date = localDateString(new Date())): DashboardSummary {
  const now = new Date().toISOString();

  return {
    date,
    rangeStart: now,
    rangeEnd: now,
    generatedAt: now,
    metrics: {
      todayJobs: 0,
      scheduledRows: 0,
      assignedJobs: 0,
      pendingReview: 0,
      unassignedJobs: 0,
      activeCrewScheduled: 0,
      activeCrewTotal: 0,
      needsAttention: 0,
      conflictCount: 0,
    },
    schedulePreview: [],
    attentionItems: [],
  };
}

function todaySummaryQuery() {
  const now = new Date();

  return {
    date: localDateString(now),
    timezoneOffsetMinutes: now.getTimezoneOffset(),
  };
}

export default function DashboardPage() {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const user = useAuthStore((state) => state.user);

  const [summary, setSummary] = useState<DashboardSummary>(() =>
    emptyDashboardSummary(),
  );
  const [greeting, setGreeting] = useState("Good day");
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const allowPlanner = currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsSummaryLoading(true);
      const query = todaySummaryQuery();

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          getDashboardSummaryRequest(accessToken, query),
        );

        if (!cancelled) {
          setSummary(result);
        }
      } catch {
        if (!cancelled) {
          setSummary(emptyDashboardSummary(query.date));
        }
      } finally {
        if (!cancelled) {
          setIsSummaryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [withAccessTokenRetry]);

  const scheduleItems = useMemo<ScheduleItem[]>(
    () =>
      summary.schedulePreview.map((item) => ({
        id: item.id,
        customerName: item.customerName,
        customerInitials: item.customerInitials || initialsFor(item.customerName),
        serviceAddress: item.serviceAddress,
        jobType: item.jobType,
        status: item.status,
        time: formatTimeRange(item.scheduledStartAt, item.scheduledEndAt),
        assignee: item.assignee,
      })),
    [summary.schedulePreview],
  );

  return (
    <AppShell
      title="Dashboard"
      description="Daily dispatch context, schedule movement, and AI-assisted planning."
    >
      <AuthGuard>
        <section className="relative overflow-hidden rounded-lg bg-[image:var(--gradient-brand)] px-7 py-6 text-white shadow-[0_18px_44px_-28px_var(--color-brand-glow)] sm:px-8">
          <div className="pointer-events-none absolute -right-7 -top-8 h-[128px] w-[128px] rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-24 h-[92px] w-[92px] rounded-full bg-white/10 opacity-60" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.12)_100%)]" />
          <div className="relative">
            <p className="text-sm font-medium text-white/80">
              {greeting}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-white sm:text-2xl">
              You have {summary.metrics.todayJobs} {summary.metrics.todayJobs === 1 ? "job" : "jobs"} scheduled today
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              {summary.metrics.assignedJobs} assigned · {summary.metrics.pendingReview} pending review · {summary.metrics.unassignedJobs === 0 ? "All crew on track" : `${summary.metrics.unassignedJobs} unassigned`}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today Jobs"
            value={String(summary.metrics.todayJobs)}
            icon={<Briefcase className="h-[18px] w-[18px]" />}
            tone="brand"
            meta="Visible on board"
          />
          <StatCard
            label="Scheduled Rows"
            value={String(summary.metrics.scheduledRows)}
            icon={<Calendar className="h-[18px] w-[18px]" />}
            tone="indigo"
            meta="Loaded for today"
          />
          <StatCard
            label="Pending Review"
            value={String(summary.metrics.pendingReview)}
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            tone="warning"
            meta="Needs manager action"
          />
          <StatCard
            label="Active Crew"
            value={`${summary.metrics.activeCrewScheduled} / ${summary.metrics.activeCrewTotal}`}
            icon={<Users className="h-[18px] w-[18px]" />}
            tone="success"
            meta={`${summary.metrics.unassignedJobs} unassigned`}
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
                  {summary.metrics.needsAttention}
                </span>
              </div>
            </div>

            <div className="space-y-1 p-2">
              {isSummaryLoading ? (
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
      </AuthGuard>
    </AppShell>
  );
}
