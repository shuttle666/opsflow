"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatCard } from "@/components/ui/info-cards";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { listMembershipsRequest } from "@/features/membership";
import {
  formatTimeRange,
  getScheduleDayRequest,
} from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipListItem } from "@/types/membership";
import type { ScheduleDayJobItem, ScheduleDayResult } from "@/types/job";

const hourHeight = 72;
const dayHours = Array.from({ length: 24 }, (_, hour) => hour);

function canManageSchedule(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function canViewSchedule(role: string | undefined) {
  return canManageSchedule(role) || role === "STAFF";
}

function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHourLabel(hour: number) {
  return new Date(2026, 0, 1, hour, 0, 0).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBlockMetrics(job: ScheduleDayJobItem) {
  if (!job.scheduledStartAt || !job.scheduledEndAt) {
    return { top: 0, height: hourHeight };
  }

  const start = new Date(job.scheduledStartAt);
  const end = new Date(job.scheduledEndAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const clampedStart = Math.max(0, Math.min(startMinutes, 24 * 60));
  const clampedEnd = Math.max(clampedStart + 30, Math.min(endMinutes, 24 * 60));

  return {
    top: (clampedStart / 60) * hourHeight,
    height: Math.max(((clampedEnd - clampedStart) / 60) * hourHeight, 56),
  };
}

function ScheduleJobBlock({ job }: { job: ScheduleDayJobItem }) {
  const metrics = getBlockMetrics(job);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`absolute inset-x-2 rounded-[20px] border px-3 py-2 text-left shadow-sm transition hover:shadow-md ${
        job.hasConflict
          ? "border-rose-200 bg-rose-50/90 text-rose-900"
          : "border-cyan-200/70 bg-white/90 text-slate-800"
      }`}
      style={{
        top: `${metrics.top}px`,
        minHeight: `${metrics.height}px`,
      }}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold">{job.title}</p>
          <StatusBadge kind="job" value={job.status} />
        </div>
        <p className="text-xs text-slate-600">{job.customer.name}</p>
        <p className="text-xs font-medium text-slate-500">
          {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)}
        </p>
        {job.hasConflict ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600">
            Conflict
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default function SchedulePage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [date, setDate] = useState(todayDateInputValue);
  const [memberships, setMemberships] = useState<MembershipListItem[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [schedule, setSchedule] = useState<ScheduleDayResult | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowManage = canManageSchedule(currentTenant?.role);
  const allowView = canViewSchedule(currentTenant?.role);
  const isStaffView = currentTenant?.role === "STAFF";

  useEffect(() => {
    if (!allowManage) {
      setMemberships([]);
      setIsLoadingMembers(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoadingMembers(true);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listMembershipsRequest(accessToken, {
            role: "STAFF",
            status: "ACTIVE",
            page: 1,
            pageSize: 50,
          }),
        );

        if (!cancelled) {
          setMemberships(result.items);
        }
      } catch {
        if (!cancelled) {
          setMemberships([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowManage, withAccessTokenRetry]);

  useEffect(() => {
    if (!allowView) {
      setSchedule(null);
      setIsLoadingSchedule(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoadingSchedule(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          getScheduleDayRequest(accessToken, {
            date,
            assigneeId: selectedAssigneeId || undefined,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          }),
        );

        if (!cancelled) {
          setSchedule(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load schedule.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowView, date, selectedAssigneeId, withAccessTokenRetry]);

  const visibleLanes = useMemo(
    () => schedule?.lanes ?? [],
    [schedule],
  );

  return (
    <AppShell
      title={isStaffView ? "My Schedule" : "Schedule"}
      description={
        isStaffView
          ? "Read-only view of your assigned jobs for the selected day."
          : "Team day view for dispatch planning and conflict review."
      }
      actions={
        allowManage ? (
          <Link href="/agent" className={primaryButtonClassName}>
            Plan with AI
          </Link>
        ) : undefined
      }
    >
      <AuthGuard>
        {!allowView ? (
          <EmptyStatePanel
            title="Schedule is unavailable"
            description="Your current role cannot access the schedule view."
          />
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Scheduled jobs"
                value={String(schedule?.totalJobs ?? 0)}
                meta={isStaffView ? "Assigned to you for this day" : "Visible in this day view"}
              />
              <StatCard
                label={isStaffView ? "Your conflicts" : "Conflict count"}
                value={String(schedule?.conflictCount ?? 0)}
                tone={schedule?.conflictCount ? "warning" : "success"}
                meta={
                  schedule?.conflictCount
                    ? isStaffView
                      ? "Overlapping assignments on your schedule"
                      : "Needs dispatch review"
                    : "No overlaps detected"
                }
              />
              <StatCard
                label="Visible lanes"
                value={String(visibleLanes.length)}
                tone="indigo"
                meta={isStaffView ? "Your personal schedule lane" : "Staff + unassigned"}
              />
            </section>

            <section className={`${surfaceClassName} p-6`}>
              <div
                className={
                  allowManage
                    ? "grid gap-4 lg:grid-cols-[220px_220px_auto]"
                    : "grid gap-4 lg:grid-cols-[220px_auto]"
                }
              >
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClassName}
                  />
                </label>

                {allowManage ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Assignee</span>
                    <select
                      value={selectedAssigneeId}
                      onChange={(event) => setSelectedAssigneeId(event.target.value)}
                      disabled={isLoadingMembers}
                      className={selectClassName}
                    >
                      <option value="">All staff</option>
                      {memberships.map((membership) => (
                        <option key={membership.userId} value={membership.userId}>
                          {membership.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="flex items-end">
                  <p className="text-sm text-slate-500">
                    {allowManage
                      ? "Review team load, spot overlaps, then use the planner to propose a new booking."
                      : "Review your assigned work for the day. This view is read-only."}
                  </p>
                </div>
              </div>

              {error ? <div className="mt-4"><InlineErrorBanner message={error} /></div> : null}
            </section>

            {isLoadingSchedule ? (
              <LoadingPanel label="Loading schedule..." />
            ) : !schedule || visibleLanes.length === 0 ? (
              <EmptyStatePanel
                title="No schedule lanes available"
                description={
                  allowManage
                    ? "Add active staff members or remove the current assignee filter."
                    : "No scheduled jobs are assigned to you for this day."
                }
              />
            ) : (
              <section className={`${surfaceClassName} overflow-hidden p-0`}>
                <div className="overflow-x-auto">
                  <div
                    className="grid min-w-[1080px]"
                    style={{
                      gridTemplateColumns: `88px repeat(${visibleLanes.length}, minmax(240px, 1fr))`,
                    }}
                  >
                    <div className="border-r border-white/40 bg-white/50">
                      <div className="h-16 border-b border-white/40 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Time
                      </div>
                      <div className="relative" style={{ height: `${hourHeight * 24}px` }}>
                        {dayHours.map((hour) => (
                          <div
                            key={hour}
                            className="absolute inset-x-0 border-t border-dashed border-slate-200/80 px-4 pt-2 text-xs text-slate-400"
                            style={{ top: `${hour * hourHeight}px` }}
                          >
                            {formatHourLabel(hour)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {visibleLanes.map((lane) => (
                      <div key={lane.key} className="min-w-[240px] border-r border-white/30 last:border-r-0">
                        <div className="flex h-16 items-center justify-between border-b border-white/40 bg-white/40 px-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{lane.label}</p>
                            <p className="text-xs text-slate-500">
                              {lane.jobs.length} job{lane.jobs.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          {lane.hasConflict ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600">
                              Conflict
                            </span>
                          ) : null}
                        </div>

                        <div
                          className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(248,250,252,0.78)_100%)]"
                          style={{ height: `${hourHeight * 24}px` }}
                        >
                          {dayHours.map((hour) => (
                            <div
                              key={`${lane.key}-${hour}`}
                              className="absolute inset-x-0 border-t border-dashed border-slate-200/70"
                              style={{ top: `${hour * hourHeight}px` }}
                            />
                          ))}

                          {lane.jobs.map((job) => (
                            <ScheduleJobBlock key={job.id} job={job} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
