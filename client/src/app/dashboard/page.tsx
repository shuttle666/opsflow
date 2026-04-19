"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ActivityLogCard } from "@/components/activity/activity-log-card";
import {
  TodaysScheduleCard,
  type ScheduleItem,
} from "@/components/dashboard/todays-schedule-card";
import {
  Briefcase,
  Calendar,
  CreditCard,
  Sparkles,
  Users,
} from "@/components/ui/icons";
import { AppShell } from "@/components/ui/app-shell";
import { StatCard } from "@/components/ui/info-cards";
import { primaryButtonClassName, secondaryButtonClassName, strongSurfaceClassName } from "@/components/ui/styles";
import { listActivityFeedRequest } from "@/features/activity/activity-api";
import { formatTimeRange, listJobsRequest } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { ActivityFeedItem } from "@/types/activity";

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
  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [jobCount, setJobCount] = useState(0);
  const allowPlanner = currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  // Load today's schedule
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
            })),
          );
          setJobCount(result.pagination.total);
        }
      } catch {
        if (!cancelled) {
          setScheduleItems([]);
          setJobCount(0);
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

  useEffect(() => {
    let cancelled = false;

    if (!allowPlanner) {
      setActivityItems([]);
      setIsActivityLoading(false);
      return;
    }

    void (async () => {
      setIsActivityLoading(true);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listActivityFeedRequest(accessToken, { page: 1, pageSize: 5 }),
        );

        if (!cancelled) {
          setActivityItems(
            result.items.map((item) => ({
              ...item,
              timestamp: new Date(item.timestamp).toLocaleString(),
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setActivityItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsActivityLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowPlanner, withAccessTokenRetry]);

  return (
    <AppShell
      title="Dashboard"
      description="Live dispatch context, schedule movement, and workspace activity."
    >
      <AuthGuard>
        <section className={`${strongSurfaceClassName} overflow-hidden p-6`}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand)]">
                Good day{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-[var(--color-text)]">
                {jobCount} jobs are visible on today&apos;s board
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Keep the crew moving with current schedules, recent activity, and AI-assisted dispatch planning.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowPlanner ? (
                <Link href="/agent" className={primaryButtonClassName}>
                  <Sparkles className="h-4 w-4" />
                  Plan with AI
                </Link>
              ) : null}
              <Link href="/schedule" className={secondaryButtonClassName}>
                <Calendar className="h-4 w-4" />
                Open schedule
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="New Jobs"
            value={String(jobCount)}
            icon={<Briefcase className="h-[18px] w-[18px]" />}
            tone="brand"
            trend={12}
            trendLabel="+12% from last week"
          />
          <StatCard
            label="Revenue This Month"
            value="$48,200"
            icon={<CreditCard className="h-[18px] w-[18px]" />}
            tone="success"
            trend={8}
            trendLabel="+8% vs target"
          />
          <StatCard
            label="Today"
            value={String(scheduleItems.length)}
            icon={<Calendar className="h-[18px] w-[18px]" />}
            tone="warning"
            meta="Scheduled visits"
          />
          <StatCard
            label="Active Crew"
            value="12"
            icon={<Users className="h-[18px] w-[18px]" />}
            tone="indigo"
            meta="All teams deployed"
          />
        </section>

        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TodaysScheduleCard items={scheduleItems} loading={isScheduleLoading} />
          {allowPlanner ? (
            <ActivityLogCard
              title="Activity"
              items={activityItems}
              loading={isActivityLoading}
              emptyTitle="No recent activity"
              emptyDescription="Workspace activity will appear here."
            />
          ) : null}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
