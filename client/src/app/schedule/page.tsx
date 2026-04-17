"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import {
  ArrowRight,
  BellRing,
  Briefcase,
  Calendar,
  Layers3,
  ShieldCheck,
  Users,
} from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatCard } from "@/components/ui/info-cards";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  surfaceClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { listMembershipsRequest } from "@/features/membership";
import {
  formatTimeRange,
  getScheduleRangeRequest,
} from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipListItem } from "@/types/membership";
import type { ScheduleDayJobItem, ScheduleLane, ScheduleRangeResult } from "@/types/job";

type ViewMode = "day" | "week" | "month";

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
const hourHeight = 72;
const dayHours = Array.from({ length: 24 }, (_, hour) => hour);

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

function formatHourLabel(hour: number) {
  return new Date(2026, 0, 1, hour, 0, 0).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPeriod(anchorDate: Date, viewMode: ViewMode): Period {
  if (viewMode === "day") {
    const start = startOfLocalDay(anchorDate);
    const end = addDays(start, 1);
    return {
      start,
      end,
      days: [start],
      title: formatLongDate(start),
    };
  }

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
  if (viewMode === "day") {
    return "day";
  }
  return viewMode === "week" ? "week" : "month";
}

function viewModeLabel(viewMode: ViewMode) {
  if (viewMode === "day") {
    return "Day view";
  }
  return viewMode === "week" ? "Week view" : "Month view";
}

function previousLabel(viewMode: ViewMode) {
  if (viewMode === "day") {
    return "Previous day";
  }
  return viewMode === "week" ? "Previous week" : "Previous month";
}

function nextLabel(viewMode: ViewMode) {
  if (viewMode === "day") {
    return "Next day";
  }
  return viewMode === "week" ? "Next week" : "Next month";
}

function getDayBlockMetrics(job: ScheduleDayJobItem, day: Date) {
  if (!job.scheduledStartAt || !job.scheduledEndAt) {
    return { top: 0, height: hourHeight };
  }

  const dayStart = startOfLocalDay(day);
  const dayEnd = addDays(dayStart, 1);
  const start = new Date(job.scheduledStartAt);
  const end = new Date(job.scheduledEndAt);
  const visibleStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
  const visibleEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));
  const startMinutes = ((visibleStart.getTime() - dayStart.getTime()) / 60_000);
  const endMinutes = ((visibleEnd.getTime() - dayStart.getTime()) / 60_000);
  const clampedStart = Math.max(0, Math.min(startMinutes, 24 * 60));
  const clampedEnd = Math.max(clampedStart + 30, Math.min(endMinutes, 24 * 60));

  return {
    top: (clampedStart / 60) * hourHeight,
    height: Math.max(((clampedEnd - clampedStart) / 60) * hourHeight, 56),
  };
}

function DayJobBlock({
  day,
  job,
}: {
  day: Date;
  job: ScheduleDayJobItem;
}) {
  const metrics = getDayBlockMetrics(job, day);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        "absolute inset-x-2 rounded-lg border px-3 py-2 text-left shadow-sm transition hover:shadow-md",
        job.hasConflict
          ? "border-rose-200 bg-rose-50/90 text-rose-900"
          : "border-cyan-100 bg-white/90 text-slate-800",
      )}
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600">
            Conflict
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function DayView({
  day,
  lanes,
  embedded = false,
}: {
  day: Date;
  lanes: ScheduleLane[];
  embedded?: boolean;
}) {
  return (
    <section className={embedded ? "overflow-hidden p-0" : `${surfaceClassName} overflow-hidden p-0`}>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[1080px]"
          style={{
            gridTemplateColumns: `88px repeat(${lanes.length}, minmax(240px, 1fr))`,
          }}
        >
          <div className="border-r border-white/40 bg-white/50">
            <div className="h-16 border-b border-white/40 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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

          {lanes.map((lane) => (
            <div key={lane.key} className="min-w-[240px] border-r border-white/30 last:border-r-0">
              <div className="flex h-16 items-center justify-between border-b border-white/40 bg-white/40 px-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{lane.label}</p>
                  <p className="text-xs text-slate-500">
                    {lane.jobs.length} job{lane.jobs.length === 1 ? "" : "s"}
                  </p>
                </div>
                {lane.hasConflict ? (
                  <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600">
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

                {lane.jobs
                  .filter((job) => jobOverlapsDay(job, day))
                  .sort(compareJobsByTime)
                  .map((job) => (
                    <DayJobBlock key={job.id} day={day} job={job} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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
  embedded = false,
}: {
  days: Date[];
  jobs: ScheduleJobWithLane[];
  embedded?: boolean;
}) {
  const today = todayLocalDate();

  return (
    <section className={embedded ? "overflow-hidden p-0" : `${surfaceClassName} overflow-hidden p-0`}>
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
  embedded = false,
}: {
  anchorDate: Date;
  days: Date[];
  jobs: ScheduleJobWithLane[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  embedded?: boolean;
}) {
  const today = todayLocalDate();
  const selectedJobs = jobsForDay(jobs, selectedDate);

  return (
    <div className={cn("grid xl:grid-cols-[minmax(0,1fr)_360px]", embedded ? "gap-0" : "gap-6")}>
      <section
        className={cn(
          embedded
            ? "overflow-hidden p-0 xl:border-r xl:border-white/50"
            : `${surfaceClassName} overflow-hidden p-0`,
        )}
      >
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

      <section
        className={cn(
          embedded
            ? "border-t border-white/50 bg-white/32 p-5 xl:border-l-0 xl:border-t-0"
            : `${surfaceClassName} p-5`,
        )}
      >
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

function CalendarToolbar({
  period,
  viewMode,
  onMovePeriod,
  onToday,
  onViewModeChange,
  anchorDate,
  onDateChange,
  allowManage,
  isLoadingMembers,
  memberships,
  selectedAssigneeId,
  onAssigneeChange,
  datePickerRef,
}: {
  period: Period;
  viewMode: ViewMode;
  onMovePeriod: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  anchorDate: Date;
  onDateChange: (value: string) => void;
  allowManage: boolean;
  isLoadingMembers: boolean;
  memberships: MembershipListItem[];
  selectedAssigneeId: string;
  onAssigneeChange: (value: string) => void;
  datePickerRef: React.RefObject<HTMLInputElement | null>;
}) {
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const [isAssigneeMenuOpen, setIsAssigneeMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAssigneeMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!assigneeMenuRef.current?.contains(event.target as Node)) {
        setIsAssigneeMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isAssigneeMenuOpen]);

  function openDatePicker() {
    const input = datePickerRef.current;
    if (!input) {
      return;
    }

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <section className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            ref={datePickerRef}
            type="date"
            value={toDateInputValue(anchorDate)}
            onChange={(event) => onDateChange(event.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={openDatePicker}
            className="group flex min-w-[240px] items-start gap-3 rounded-2xl border border-white/75 bg-white/88 px-4 py-3 text-left shadow-sm transition hover:bg-white"
          >
            <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
              <Calendar className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {viewModeLabel(viewMode)}
              </span>
              <span className="mt-1 block truncate text-lg font-bold text-slate-900">
                {period.title}
              </span>
            </span>
          </button>
        </div>

        {allowManage ? (
          <div ref={assigneeMenuRef} className="relative">
            <button
              type="button"
              aria-label="Assignee filter"
              aria-expanded={isAssigneeMenuOpen}
              onClick={() => setIsAssigneeMenuOpen((open) => !open)}
              disabled={isLoadingMembers}
              className={cn(
                subtleButtonClassName,
                "h-12 w-12 px-0",
                selectedAssigneeId && "!border-cyan-300 !bg-cyan-50 !text-cyan-700",
              )}
            >
              <Users className="h-7 w-7" />
            </button>

            {isAssigneeMenuOpen ? (
              <div className="absolute left-0 top-[3.25rem] z-20 min-w-[220px] rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_18px_38px_-24px_rgba(15,23,42,0.28)] backdrop-blur">
                <div className="mb-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Assignee
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      onAssigneeChange("");
                      setIsAssigneeMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                      !selectedAssigneeId
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    All staff
                  </button>
                  {memberships.map((membership) => (
                    <button
                      key={membership.userId}
                      type="button"
                      onClick={() => {
                        onAssigneeChange(membership.userId);
                        setIsAssigneeMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                        selectedAssigneeId === membership.userId
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {membership.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className="flex flex-wrap items-center gap-2">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                subtleButtonClassName,
                "capitalize",
                viewMode === mode && "!border-slate-900 !bg-slate-900 !text-white hover:!bg-slate-800",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-start lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={previousLabel(viewMode)}
            onClick={() => onMovePeriod(-1)}
            className={cn(subtleButtonClassName, "h-12 w-12 px-0")}
          >
            <ArrowRight className="h-7 w-7 rotate-180" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className={secondaryButtonClassName}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={nextLabel(viewMode)}
            onClick={() => onMovePeriod(1)}
            className={cn(subtleButtonClassName, "h-12 w-12 px-0")}
          >
            <ArrowRight className="h-7 w-7" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function SchedulePage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const datePickerRef = useRef<HTMLInputElement>(null);
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
      const next =
        viewMode === "day"
          ? addDays(current, direction)
          : viewMode === "week"
            ? addDays(current, direction * 7)
            : addMonths(current, direction);
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
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Scheduled jobs"
                value={String(schedule?.totalJobs ?? 0)}
                icon={<Briefcase className="h-[18px] w-[18px]" />}
                meta={isStaffView ? `Assigned to you this ${currentPeriodWord}` : `Visible this ${currentPeriodWord}`}
              />
              <StatCard
                label={isStaffView ? "Your conflicts" : "Conflict count"}
                value={String(schedule?.conflictCount ?? 0)}
                tone={schedule?.conflictCount ? "warning" : "success"}
                icon={
                  schedule?.conflictCount ? (
                    <BellRing className="h-[18px] w-[18px]" />
                  ) : (
                    <ShieldCheck className="h-[18px] w-[18px]" />
                  )
                }
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
                icon={<Layers3 className="h-[18px] w-[18px]" />}
                meta={isStaffView ? "Your personal schedule lane" : "Staff + unassigned"}
              />
            </section>

            <section className={`${surfaceClassName} overflow-hidden p-0`}>
              <div className="border-b border-white/60 bg-white/38">
                <CalendarToolbar
                  period={period}
                  viewMode={viewMode}
                  onMovePeriod={handleMovePeriod}
                  onToday={handleToday}
                  onViewModeChange={handleViewModeChange}
                  anchorDate={anchorDate}
                  onDateChange={handleDateChange}
                  allowManage={allowManage}
                  isLoadingMembers={isLoadingMembers}
                  memberships={memberships}
                  selectedAssigneeId={selectedAssigneeId}
                  onAssigneeChange={setSelectedAssigneeId}
                  datePickerRef={datePickerRef}
                />
              </div>

              {error ? (
                <div className="px-5 pt-4">
                  <InlineErrorBanner message={error} />
                </div>
              ) : null}

              {isLoadingSchedule ? (
                <div className="p-5">
                  <LoadingPanel label="Loading schedule..." />
                </div>
              ) : !schedule || visibleLanes.length === 0 ? (
                <div className="p-5">
                  <EmptyStatePanel
                    title="No schedule lanes available"
                    description={
                      allowManage
                        ? "Add active staff members or remove the current assignee filter."
                        : `No scheduled jobs are assigned to you for this ${currentPeriodWord}.`
                    }
                  />
                </div>
              ) : viewMode === "day" ? (
                <DayView day={period.start} lanes={visibleLanes} embedded />
              ) : viewMode === "week" ? (
                <WeekView days={period.days} jobs={visibleJobs} embedded />
              ) : (
                <MonthView
                  anchorDate={anchorDate}
                  days={period.days}
                  jobs={visibleJobs}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  embedded
                />
              )}
            </section>
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
