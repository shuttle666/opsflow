"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  TodaysScheduleCard,
  type ScheduleItem,
} from "@/components/dashboard/todays-schedule-card";
import {
  Briefcase,
  CreditCard,
  Users,
} from "@/components/ui/icons";
import { AppShell } from "@/components/ui/app-shell";
import { StatCard } from "@/components/ui/info-cards";
import { listJobsRequest } from "@/features/job/job-api";
import { useAuthStore } from "@/store/auth-store";

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

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [jobCount, setJobCount] = useState(0);

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
            sort: "scheduledAt_asc",
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
              time: job.scheduledAt
                ? new Date(job.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "-",
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

  return (
    <AppShell title="Dashboard">
      <AuthGuard>
        {/* Stats Grid */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            label="Active Crew"
            value="12"
            icon={<Users className="h-[18px] w-[18px]" />}
            tone="indigo"
            meta="All teams deployed"
          />
        </section>

        <div className="min-h-0 flex-1">
          <TodaysScheduleCard items={scheduleItems} loading={isScheduleLoading} />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
