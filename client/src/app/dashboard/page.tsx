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
import { formatTimeRange, listJobsRequest } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { JobStatus } from "@/types/job";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function DashboardPage() {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const user = useAuthStore((state) => state.user);

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [greeting, setGreeting] = useState("Good day");
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [jobCount, setJobCount] = useState(0);
  const [attentionItems, setAttentionItems] = useState<
    Array<{ id: string; title: string; customer: string; status: JobStatus; assignee?: string }>
  >([]);
  const allowPlanner = currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsScheduleLoading(true);

      try {
        const { from, to } = todayRange();
        const result = await withAccessTokenRetry((accessToken) =>
          listJobsRequest(accessToken, {
            scheduledFrom: from,
            scheduledTo: to,
            page: 1,
            pageSize: 10,
            sort: "scheduledStartAt_asc",
          }),
        );

        if (!cancelled) {
          setScheduleItems(
            result.items.map((job) => ({
              id: job.id,
              customerName: job.customer.name,
              customerInitials: initialsFor(job.customer.name),
              jobType: job.title,
              status: job.status,
              time: formatTimeRange(job.scheduledStartAt, job.scheduledEndAt),
              assignee: job.assignedToName ?? undefined,
            })),
          );
          setJobCount(result.pagination.total);
          setAttentionItems(
            result.items
              .filter(
                (job) =>
                  job.status === "PENDING_REVIEW" ||
                  job.status === "NEW" ||
                  !job.assignedToName,
              )
              .slice(0, 4)
              .map((job) => ({
                id: job.id,
                title: job.title,
                customer: job.customer.name,
                status: job.status,
                assignee: job.assignedToName ?? undefined,
              })),
          );
        }
      } catch {
        if (!cancelled) {
          setScheduleItems([]);
          setJobCount(0);
          setAttentionItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [withAccessTokenRetry]);

  const dashboardStats = useMemo(() => {
    const pendingReviewCount = scheduleItems.filter(
      (item) => item.status === "PENDING_REVIEW",
    ).length;
    const unassignedCount = scheduleItems.filter((item) => !item.assignee).length;
    const activeCrewCount = new Set(
      scheduleItems.map((item) => item.assignee).filter(Boolean),
    ).size;
    const assignedCount = scheduleItems.filter((item) => item.assignee).length;

    return {
      assignedCount,
      pendingReviewCount,
      unassignedCount,
      activeCrewCount,
    };
  }, [scheduleItems]);

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
              You have {jobCount} {jobCount === 1 ? "job" : "jobs"} scheduled today
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              {dashboardStats.assignedCount} assigned · {dashboardStats.pendingReviewCount} pending review · {dashboardStats.unassignedCount === 0 ? "All crew on track" : `${dashboardStats.unassignedCount} unassigned`}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today Jobs"
            value={String(jobCount)}
            icon={<Briefcase className="h-[18px] w-[18px]" />}
            tone="brand"
            meta="Visible on board"
          />
          <StatCard
            label="Scheduled Rows"
            value={String(scheduleItems.length)}
            icon={<Calendar className="h-[18px] w-[18px]" />}
            tone="indigo"
            meta="Loaded for today"
          />
          <StatCard
            label="Pending Review"
            value={String(dashboardStats.pendingReviewCount)}
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            tone="warning"
            meta="Needs manager action"
          />
          <StatCard
            label="Active Crew"
            value={String(dashboardStats.activeCrewCount)}
            icon={<Users className="h-[18px] w-[18px]" />}
            tone="success"
            meta={`${dashboardStats.unassignedCount} unassigned`}
          />
        </section>

        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TodaysScheduleCard items={scheduleItems} loading={isScheduleLoading} />
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
                  {attentionItems.length}
                </span>
              </div>
            </div>

            <div className="space-y-1 p-2">
              {isScheduleLoading ? (
                <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">Checking today&apos;s board...</p>
              ) : attentionItems.length === 0 ? (
                <div className="px-3 py-6 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text)]">All clear</p>
                  <p className="mt-1 leading-6">No pending review, new, or unassigned jobs in today&apos;s loaded board.</p>
                </div>
              ) : (
                attentionItems.map((item) => (
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
