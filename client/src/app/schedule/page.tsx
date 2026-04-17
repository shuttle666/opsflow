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
  cn,
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { listMembershipsRequest } from "@/features/membership";
import {
  formatTimeRange,
  getScheduleRangeRequest,
} from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipListItem } from "@/types/membership";
import type { ScheduleDayJobItem, ScheduleLane, ScheduleRangeResult } from "@/types/job";

type ViewMode = "week" | "month";

type Period = {
  start: Date;
  end: Date;
  days: Date[];
  title: string;
};

type ScheduleJobWithLane = ScheduleDayJobItem & {
  laneLabel: string;
};

const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function canManageSchedule(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function canViewSchedule(role: string | undefined) {
  return canManageSchedule(role) || role === "STAFF";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function todayLocalDate() {
  return startOfLocalDay(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

function addMonths(date: Date, months: number) {
  return startOfLocalDay(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? todayLocalDate() : startOfLocalDay(parsed);
}

function startOfMondayWeek(date: Date) {
  const localDay = startOfLocalDay(date);
  const dayOffset = (localDay.getDay() + 6) % 7;
  return addDays(localDay, -dayOffset);
}

function getDaysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let current = startOfLocalDay(start); current < end; current = addDays(current, 1)) {
    days.push(current);
  }
  return days;
}

function formatWeekTitle(start: Date, end: Date) {
  const lastDay = addDays(end, -1);
  const includeStartYear = start.getFullYear() !== lastDay.getFullYear();
  const startLabel = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(includeStartYear ? { year: "numeric" as const } : {}),
  });
  const endLabel = lastDay.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function getPeriod(anchorDate: Date, viewMode: ViewMode): Period {
  if (viewMode === "week") {
    const start = startOfMondayWeek(anchorDate);
    const end = addDays(start, 7);
    return {
      start,
      end,
      days: getDaysBetween(start, end),
      title: formatWeekTitle(start, end),
    };
  }

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const start = startOfMondayWeek(monthStart);
  const end = addDays(startOfMondayWeek(monthEnd), 7);

  return {
    start,
    end,
    days: getDaysBetween(start, end),
    title: anchorDate.toLocaleDateString([], {
      month: "long",
      year: "numeric",
    }),
  };
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getJobStart(job: ScheduleDayJobItem) {
  return job.scheduledStartAt ? new Date(job.scheduledStartAt) : null;
}

function jobOverlapsDay(job: ScheduleDayJobItem, day: Date) {
  if (!job.scheduledStartAt || !job.scheduledEndAt) {
    return false;
  }

  const dayStart = startOfLocalDay(day);
  const dayEnd = addDays(dayStart, 1);
  const jobStart = new Date(job.scheduledStartAt);
  const jobEnd = new Date(job.scheduledEndAt);

  return jobStart < dayEnd && jobEnd > dayStart;
}

function compareJobsByTime(left: ScheduleDayJobItem, right: ScheduleDayJobItem) {
  const leftStart = getJobStart(left)?.getTime() ?? 0;
  const rightStart = getJobStart(right)?.getTime() ?? 0;
  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }
  return left.title.localeCompare(right.title);
}

function collectJobs(lanes: ScheduleLane[]) {
  return lanes
    .flatMap((lane) =>
      lane.jobs.map((job) => ({
        ...job,
        laneLabel: lane.label,
      })),
    )
    .sort(compareJobsByTime);
}

function jobsForDay(jobs: ScheduleJobWithLane[], day: Date) {
  return jobs.filter((job) => jobOverlapsDay(job, day)).sort(compareJobsByTime);
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function jobAssigneeLabel(job: ScheduleJobWithLane) {
  return job.assignedTo?.displayName ?? job.laneLabel;
}

function periodWord(viewMode: ViewMode) {
  return viewMode === "week" ? "week" : "month";
}

function ScheduleJobCard({
  job,
  compact = false,
}: {
  job: ScheduleJobWithLane;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        "block rounded-lg border p-3 text-left shadow-sm transition hover:shadow-md",
        job.hasConflict
          ? "border-rose-200 bg-rose-50/90 text-rose-900"
          : "border-cyan-100 bg-white/90 text-slate-800",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)}
            </p>
            <p className={cn("font-semibold text-slate-900", compact ? "line-clamp-2 text-sm" : "text-sm")}>
              {job.title}
            </p>
          </div>
          {!compact ? <StatusBadge kind="job" value={job.status} /> : null}
        </div>
        <div className="space-y-1 text-xs text-slate-600">
          <p>{job.customer.name}</p>
          <p>{jobAssigneeLabel(job)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {compact ? <StatusBadge kind="job" value={job.status} /> : <span />}
          {job.hasConflict ? (
            <span className="rounded-full border border-rose-200 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600">
              Conflict
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function WeekView({
  days,
  jobs,
}: {
  days: Date[];
  jobs: ScheduleJobWithLane[];
}) {
  const today = todayLocalDate();

  return (
    <section className={`${surfaceClassName} overflow-hidden p-0`}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7">
          {days.map((day) => {
            const dayJobs = jobsForDay(jobs, day);
            const isToday = isSameLocalDate(day, today);

            return (
              <div key={day.toISOString()} className="min-h-[520px] border-r border-white/40 last:border-r-0">
                <div
                  className={cn(
                    "border-b border-white/50 px-4 py-4",
                    isToday ? "bg-cyan-50/80" : "bg-white/45",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {weekDayLabels[(day.getDay() + 6) % 7]}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-base font-bold text-slate-900">{formatDayLabel(day)}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        isToday ? "bg-cyan-600 text-white" : "bg-white/80 text-slate-500",
                      )}
                    >
                      {dayJobs.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  {dayJobs.length > 0 ? (
                    dayJobs.map((job) => (
                      <ScheduleJobCard key={`${day.toISOString()}-${job.id}`} job={job} compact />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-6 text-center text-sm text-slate-400">
                      No jobs
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MonthView({
  anchorDate,
  days,
  jobs,
  selectedDate,
  onSelectDate,
}: {
  anchorDate: Date;
  days: Date[];
  jobs: ScheduleJobWithLane[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const today = todayLocalDate();
  const selectedJobs = jobsForDay(jobs, selectedDate);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className={`${surfaceClassName} overflow-hidden p-0`}>
        <div className="grid grid-cols-7 border-b border-white/50 bg-white/45">
          {weekDayLabels.map((label) => (
            <div
              key={label}
              className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayJobs = jobsForDay(jobs, day);
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = isSameLocalDate(day, today);
            const isSelected = isSameLocalDate(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "min-h-36 border-r border-b border-white/45 p-3 text-left transition last:border-r-0 hover:bg-white/70",
                  isSelected ? "bg-cyan-50/90 ring-2 ring-inset ring-cyan-300" : "bg-white/35",
                  !isCurrentMonth && "text-slate-400",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                      isToday ? "bg-cyan-600 text-white" : "bg-white/80 text-slate-700",
                      !isCurrentMonth && !isToday && "text-slate-400",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-slate-500">
                    {dayJobs.length}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {dayJobs.slice(0, 3).map((job) => (
                    <div
                      key={`${day.toISOString()}-${job.id}`}
                      className={cn(
                        "truncate rounded-md border px-2 py-1 text-xs font-medium",
                        job.hasConflict
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-cyan-100 bg-white/85 text-slate-700",
                      )}
                    >
                      {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)} {job.title}
                    </div>
                  ))}
                  {dayJobs.length > 3 ? (
                    <p className="px-1 text-xs font-semibold text-slate-500">
                      +{dayJobs.length - 3} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${surfaceClassName} p-5`}>
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Selected day
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{formatLongDate(selectedDate)}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {selectedJobs.length} job{selectedJobs.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-3">
          {selectedJobs.length > 0 ? (
            selectedJobs.map((job) => (
              <ScheduleJobCard key={`selected-${job.id}`} job={job} />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-4 py-8 text-center text-sm text-slate-400">
              No jobs scheduled
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SchedulePage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(todayLocalDate);
  const [selectedDate, setSelectedDate] = useState(todayLocalDate);
  const [memberships, setMemberships] = useState<MembershipListItem[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [schedule, setSchedule] = useState<ScheduleRangeResult | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowManage = canManageSchedule(currentTenant?.role);
  const allowView = canViewSchedule(currentTenant?.role);
  const isStaffView = currentTenant?.role === "STAFF";
  const period = useMemo(() => getPeriod(anchorDate, viewMode), [anchorDate, viewMode]);
  const visibleLanes = useMemo(
    () => schedule?.lanes ?? [],
    [schedule],
  );
  const visibleJobs = useMemo(() => collectJobs(visibleLanes), [visibleLanes]);

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
          getScheduleRangeRequest(accessToken, {
            rangeStart: period.start.toISOString(),
            rangeEnd: period.end.toISOString(),
            assigneeId: selectedAssigneeId || undefined,
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
  }, [allowView, period.end, period.start, selectedAssigneeId, withAccessTokenRetry]);

  function handleMovePeriod(direction: -1 | 1) {
    setAnchorDate((current) => {
      const next = viewMode === "week" ? addDays(current, direction * 7) : addMonths(current, direction);
      setSelectedDate(next);
      return next;
    });
  }

  function handleToday() {
    const today = todayLocalDate();
    setAnchorDate(today);
    setSelectedDate(today);
  }

  function handleViewModeChange(nextViewMode: ViewMode) {
    setViewMode(nextViewMode);
    setSelectedDate(anchorDate);
  }

  function handleDateChange(value: string) {
    const next = parseDateInputValue(value);
    setAnchorDate(next);
    setSelectedDate(next);
  }

  const currentPeriodWord = periodWord(viewMode);

  return (
    <AppShell
      title={isStaffView ? "My Schedule" : "Schedule"}
      description={
        isStaffView
          ? "Your assigned jobs across the selected period."
          : "Team schedule for dispatch planning and conflict review."
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
                meta={isStaffView ? `Assigned to you this ${currentPeriodWord}` : `Visible this ${currentPeriodWord}`}
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

            <section className={`${surfaceClassName} p-5`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {viewMode === "week" ? "Week view" : "Month view"}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">{period.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {viewMode === "week" ? "Monday to Sunday" : `${period.days.length} visible days`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleMovePeriod(-1)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {viewMode === "week" ? "Previous week" : "Previous month"}
                  </button>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="h-10 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMovePeriod(1)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {viewMode === "week" ? "Next week" : "Next month"}
                  </button>
                  <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {(["week", "month"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        onClick={() => handleViewModeChange(mode)}
                        className={cn(
                          "px-4 text-sm font-semibold capitalize transition",
                          viewMode === mode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "mt-5 grid gap-4",
                  allowManage ? "lg:grid-cols-[220px_220px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]",
                )}
              >
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Jump to date</span>
                  <input
                    type="date"
                    value={toDateInputValue(anchorDate)}
                    onChange={(event) => handleDateChange(event.target.value)}
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
                      ? `Review team load, spot overlaps, and plan the selected ${currentPeriodWord}.`
                      : `Review your assigned work for the selected ${currentPeriodWord}.`}
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
                    : `No scheduled jobs are assigned to you for this ${currentPeriodWord}.`
                }
              />
            ) : viewMode === "week" ? (
              <WeekView days={period.days} jobs={visibleJobs} />
            ) : (
              <MonthView
                anchorDate={anchorDate}
                days={period.days}
                jobs={visibleJobs}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
