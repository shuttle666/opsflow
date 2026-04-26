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
  Sparkles,
  Users,
} from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatCard } from "@/components/ui/info-cards";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  strongSurfaceClassName,
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
const hourHeight = 54;
const weekHourHeight = 88;
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
    hour: "numeric",
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

function getLanesWithJobsForDay(lanes: ScheduleLane[], day: Date) {
  return lanes
    .map((lane) => {
      const jobs = lane.jobs
        .filter((job) => jobOverlapsDay(job, day))
        .sort(compareJobsByTime);

      return {
        ...lane,
        jobs,
        hasConflict: jobs.some((job) => job.hasConflict),
      };
    })
    .filter((lane) => lane.jobs.length > 0);
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

function getTimelineWindow(jobs: ScheduleJobWithLane[], days: Date[]) {
  const visibleHours = jobs
    .flatMap((job) =>
      days.flatMap((day) => {
        if (!jobOverlapsDay(job, day) || !job.scheduledStartAt || !job.scheduledEndAt) {
          return [];
        }
        const start = new Date(job.scheduledStartAt);
        const end = new Date(job.scheduledEndAt);
        return [start.getHours(), Math.max(end.getHours() + (end.getMinutes() > 0 ? 1 : 0), start.getHours() + 1)];
      }),
    );

  if (visibleHours.length === 0) {
    return { startHour: 8, endHour: 18 };
  }

  const startHour = Math.max(0, Math.min(8, Math.min(...visibleHours)));
  const endHour = Math.min(24, Math.max(18, Math.max(...visibleHours)));
  return { startHour, endHour: Math.max(startHour + 1, endHour) };
}

function getTimelineBlockMetrics(
  job: ScheduleDayJobItem,
  day: Date,
  startHour: number,
  endHour: number,
  rowHeight = hourHeight,
) {
  if (!job.scheduledStartAt || !job.scheduledEndAt) {
    return { top: 0, height: rowHeight };
  }

  const windowStart = new Date(day);
  windowStart.setHours(startHour, 0, 0, 0);
  const windowEnd = new Date(day);
  windowEnd.setHours(endHour, 0, 0, 0);
  const jobStart = new Date(job.scheduledStartAt);
  const jobEnd = new Date(job.scheduledEndAt);
  const visibleStart = new Date(Math.max(jobStart.getTime(), windowStart.getTime()));
  const visibleEnd = new Date(Math.min(jobEnd.getTime(), windowEnd.getTime()));
  const startMinutes = (visibleStart.getTime() - windowStart.getTime()) / 60_000;
  const endMinutes = (visibleEnd.getTime() - windowStart.getTime()) / 60_000;

  return {
    top: Math.max(0, (startMinutes / 60) * rowHeight),
    height: Math.max(((endMinutes - startMinutes) / 60) * rowHeight, 42),
  };
}

function jobAccent(job: ScheduleDayJobItem) {
  if (job.hasConflict) {
    return {
      background: "var(--color-danger-soft)",
      border: "var(--color-danger)",
      text: "var(--color-danger)",
    };
  }

  if (job.status === "IN_PROGRESS") {
    return {
      background: "var(--color-warning-soft)",
      border: "var(--color-warning)",
      text: "var(--color-warning)",
    };
  }

  if (job.status === "COMPLETED") {
    return {
      background: "var(--color-success-soft)",
      border: "var(--color-success)",
      text: "var(--color-success)",
    };
  }

  return {
    background: "var(--color-brand-soft)",
    border: "var(--color-brand)",
    text: "var(--color-brand)",
  };
}

const calendarEventPalette = [
  {
    background: "rgba(124, 92, 252, 0.08)",
    border: "#7c5cfc",
    text: "#7c5cfc",
  },
  {
    background: "rgba(245, 158, 11, 0.08)",
    border: "#f59e0b",
    text: "#d97706",
  },
  {
    background: "rgba(22, 163, 74, 0.08)",
    border: "#16a34a",
    text: "#16a34a",
  },
  {
    background: "rgba(14, 165, 233, 0.08)",
    border: "#0ea5e9",
    text: "#0284c7",
  },
  {
    background: "rgba(239, 68, 68, 0.08)",
    border: "#ef4444",
    text: "#dc2626",
  },
];

function getStablePaletteIndex(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % calendarEventPalette.length;
}

function calendarEventAccent(job: ScheduleDayJobItem) {
  if (job.hasConflict) {
    return calendarEventPalette[4];
  }

  if (job.status === "IN_PROGRESS") {
    return calendarEventPalette[1];
  }

  if (job.status === "COMPLETED") {
    return calendarEventPalette[2];
  }

  return calendarEventPalette[getStablePaletteIndex(job.id || job.title)];
}

function DayJobBlock({
  day,
  job,
}: {
  day: Date;
  job: ScheduleDayJobItem;
}) {
  const metrics = getDayBlockMetrics(job, day);
  const accent = jobAccent(job);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="absolute inset-x-2 overflow-hidden rounded-lg border bg-[var(--color-app-panel)] px-3 py-2 text-left shadow-sm transition hover:shadow-[var(--shadow-panel-hover)]"
      style={{
        top: `${metrics.top}px`,
        minHeight: `${metrics.height}px`,
        borderLeft: `3px solid ${accent.border}`,
        background: accent.background,
      }}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{job.title}</p>
          <StatusBadge kind="job" value={job.status} />
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">{job.customer.name}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{job.serviceAddress}</p>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)}
        </p>
        {job.hasConflict ? (
          <p className="text-[11px] font-semibold uppercase text-[var(--color-danger)]">
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
          <div className="border-r border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)]">
            <div className="h-14 border-b border-[var(--color-app-border)] px-4 py-4 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Time
            </div>
            <div className="relative" style={{ height: `${hourHeight * 24}px` }}>
              {dayHours.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-dashed border-[var(--color-app-border)] px-4 pt-2 font-mono text-[10px] text-[var(--color-text-muted)]"
                  style={{ top: `${hour * hourHeight}px` }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
          </div>

          {lanes.map((lane) => (
            <div key={lane.key} className="min-w-[240px] border-r border-[var(--color-app-border)] last:border-r-0">
              <div className="flex h-14 items-center justify-between border-b border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{lane.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {lane.jobs.length} job{lane.jobs.length === 1 ? "" : "s"}
                  </p>
                </div>
                {lane.hasConflict ? (
                  <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--color-danger)]">
                    Conflict
                  </span>
                ) : null}
              </div>

              <div
                className="relative bg-[var(--color-app-panel)]"
                style={{ height: `${hourHeight * 24}px` }}
              >
                {dayHours.map((hour) => (
                  <div
                    key={`${lane.key}-${hour}`}
                    className="absolute inset-x-0 border-t border-dashed border-[var(--color-app-border)]"
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
  const accent = jobAccent(job);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-3 text-left shadow-sm transition hover:shadow-[var(--shadow-panel-hover)]"
      style={{ borderLeft: `3px solid ${accent.border}` }}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold text-[var(--color-text-muted)]">
              {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)}
            </p>
            <p className={cn("font-semibold text-[var(--color-text)]", compact ? "line-clamp-2 text-sm" : "text-sm")}>
              {job.title}
            </p>
          </div>
          {!compact ? <StatusBadge kind="job" value={job.status} /> : null}
        </div>
        <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
          <p>{job.customer.name}</p>
          <p className="truncate text-[var(--color-text-muted)]">{job.serviceAddress}</p>
          <p>{jobAssigneeLabel(job)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {compact ? <StatusBadge kind="job" value={job.status} /> : <span />}
          {job.hasConflict ? (
            <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--color-danger)]">
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
  const { startHour, endHour } = getTimelineWindow(jobs, days);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const timelineHeight = hours.length * weekHourHeight;

  return (
    <section className={embedded ? "overflow-hidden p-0" : `${surfaceClassName} overflow-hidden p-0`}>
      <div className="overflow-x-auto bg-[var(--color-app-panel)]">
        <div className="min-w-[1120px]">
          <div
            className="grid border-b border-[var(--color-app-border)]"
            style={{ gridTemplateColumns: "70px repeat(7, minmax(150px, 1fr))" }}
          >
            <div className="bg-[var(--color-app-panel)]" />
            {days.map((day) => {
              const isToday = isSameLocalDate(day, today);

              return (
                <div
                  key={`header-${day.toISOString()}`}
                  className="h-24 border-l border-[var(--color-app-border)] px-2 py-4 text-center"
                >
                  <p className={cn("text-[13px] font-semibold uppercase", isToday ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]")}>
                    {weekDayLabels[(day.getDay() + 6) % 7]}
                  </p>
                  <div
                    className={cn(
                      "mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold",
                      isToday
                        ? "bg-[var(--color-brand)] !text-white"
                        : "text-[var(--color-text)]",
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="grid bg-[var(--color-app-panel)]"
            style={{ gridTemplateColumns: "70px repeat(7, minmax(150px, 1fr))" }}
          >
            <div className="border-r border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)]" style={{ height: timelineHeight }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex justify-end border-b border-[var(--color-app-border)] bg-[var(--color-app-panel)] pr-3 pt-2 font-mono text-[12px] text-[var(--color-text-muted)]"
                  style={{ height: weekHourHeight }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayJobs = jobsForDay(jobs, day);

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r border-[var(--color-app-border)] last:border-r-0"
                  style={{ height: timelineHeight }}
                >
                  {hours.map((hour) => (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="absolute inset-x-0 border-b border-[var(--color-app-border)]"
                      style={{ top: (hour - startHour) * weekHourHeight, height: weekHourHeight }}
                    />
                  ))}

                  {dayJobs.map((job) => {
                    const metrics = getTimelineBlockMetrics(
                      job,
                      day,
                      startHour,
                      endHour,
                      weekHourHeight,
                    );
                    const accent = calendarEventAccent(job);

                    return (
                      <Link
                        key={`${day.toISOString()}-${job.id}`}
                        href={`/jobs/${job.id}`}
                        className="absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-lg px-3 py-2 text-left transition hover:shadow-[var(--shadow-panel-hover)]"
                        style={{
                          top: `${metrics.top + 4}px`,
                          minHeight: `${Math.max(metrics.height - 8, 52)}px`,
                          background: accent.background,
                          borderLeft: `4px solid ${accent.border}`,
                        }}
                      >
                        <p className="truncate text-sm font-bold" style={{ color: accent.text }}>
                          {job.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                          {job.serviceAddress}
                        </p>
                        {job.hasConflict ? (
                          <p className="mt-2 text-[10px] font-semibold uppercase text-[var(--color-danger)]">
                            Conflict
                          </p>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
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
            ? "overflow-hidden p-0 xl:border-r xl:border-[var(--color-app-border)]"
            : `${surfaceClassName} overflow-hidden p-0`,
        )}
      >
        <div className="grid grid-cols-7 border-b border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)]">
          {weekDayLabels.map((label) => (
            <div
              key={label}
              className="px-3 py-3 text-center text-[11px] font-semibold uppercase text-[var(--color-text-muted)]"
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
                  "min-h-36 border-r border-b border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-3 text-left transition last:border-r-0 hover:bg-[var(--color-app-panel-muted)]",
                  isSelected ? "ring-2 ring-inset ring-[var(--color-brand)]" : "",
                  !isCurrentMonth && "opacity-55",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                      isToday ? "bg-[var(--color-brand)] !text-white" : "text-[var(--color-text)]",
                      !isCurrentMonth && !isToday && "text-[var(--color-text-muted)]",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="rounded-lg bg-[var(--color-app-panel-muted)] px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                    {dayJobs.length}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {dayJobs.slice(0, 3).map((job) => (
                    <div
                      key={`${day.toISOString()}-${job.id}`}
                      className="truncate rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
                      style={{ borderLeft: `3px solid ${jobAccent(job).border}` }}
                    >
                      {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)} {job.title}
                    </div>
                  ))}
                  {dayJobs.length > 3 ? (
                    <p className="px-1 text-xs font-semibold text-[var(--color-text-muted)]">
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
            ? "border-t border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-5 xl:border-l-0 xl:border-t-0"
            : `${surfaceClassName} p-5`,
        )}
      >
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
            Selected day
          </p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-text)]">{formatLongDate(selectedDate)}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {selectedJobs.length} job{selectedJobs.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-3">
          {selectedJobs.length > 0 ? (
            selectedJobs.map((job) => (
              <ScheduleJobCard key={`selected-${job.id}`} job={job} />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
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
    <section className="grid gap-3 p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-1">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-semibold capitalize text-[var(--color-text-secondary)] transition hover:bg-[var(--color-app-panel-muted)]",
                viewMode === mode && "bg-[var(--color-brand)] !text-white hover:bg-[var(--color-brand)] hover:!text-white",
              )}
            >
              {mode}
            </button>
          ))}
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
                "flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] text-[var(--color-text-secondary)] shadow-sm transition hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50",
                selectedAssigneeId && "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
              )}
            >
              <Users className="h-5 w-5" />
            </button>

            {isAssigneeMenuOpen ? (
              <div className="absolute left-0 top-11 z-20 min-w-[220px] rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-2 shadow-[var(--shadow-floating)]">
                <div className="mb-1 px-3 py-2 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
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
                      "flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium transition",
                      !selectedAssigneeId
                        ? "bg-[var(--color-text)] text-[var(--color-app-panel)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]",
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
                        "flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium transition",
                        selectedAssigneeId === membership.userId
                          ? "bg-[var(--color-text)] text-[var(--color-app-panel)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]",
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

      <div className="relative flex justify-start lg:justify-center">
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
          className="flex min-w-[220px] items-center justify-center gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-2 text-center shadow-sm transition hover:bg-[var(--color-app-panel-muted)]"
        >
          <Calendar className="h-4 w-4 text-[var(--color-brand)]" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              {viewModeLabel(viewMode)}
            </span>
            <span className="block truncate text-sm font-bold text-[var(--color-text)]">
              {period.title}
            </span>
          </span>
        </button>
      </div>

      <div className="flex justify-start lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={previousLabel(viewMode)}
            onClick={() => onMovePeriod(-1)}
            className={cn(subtleButtonClassName, "h-9 w-9 px-0")}
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className={cn(secondaryButtonClassName, "h-9")}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={nextLabel(viewMode)}
            onClick={() => onMovePeriod(1)}
            className={cn(subtleButtonClassName, "h-9 w-9 px-0")}
          >
            <ArrowRight className="h-4 w-4" />
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
  const dayLanes = useMemo(
    () => getLanesWithJobsForDay(visibleLanes, period.start),
    [period.start, visibleLanes],
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
          <div className="space-y-4">
            <section className="grid gap-3 md:grid-cols-3">
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

            {allowManage ? (
              <section className={`${strongSurfaceClassName} p-5`}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-white shadow-[0_10px_24px_-16px_var(--color-brand-glow)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        {schedule?.conflictCount
                          ? "AI can review this schedule for conflicts"
                          : "Plan the next dispatch move with AI"}
                      </p>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                        {schedule?.conflictCount
                          ? "Ask the planner to resolve overlaps, rebalance assignments, and draft a confirmed dispatch proposal."
                          : "Use the planner to create visits, assign available staff, and check timing before anything is saved."}
                      </p>
                    </div>
                  </div>

                  <Link href="/agent" className={primaryButtonClassName}>
                    <Sparkles className="h-4 w-4" />
                    Ask AI to review
                  </Link>
                </div>
              </section>
            ) : null}

            <section className={`${surfaceClassName} overflow-hidden p-0`}>
              <div className="border-b border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)]">
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
              ) : viewMode === "day" && dayLanes.length === 0 ? (
                <div className="p-5">
                  <EmptyStatePanel
                    title="No jobs scheduled"
                    description={
                      selectedAssigneeId
                        ? "The selected staff member has no jobs scheduled for this day."
                        : allowManage
                          ? "No assigned or unassigned jobs are scheduled for this day."
                          : "No jobs are assigned to you for this day."
                    }
                  />
                </div>
              ) : viewMode === "day" ? (
                <DayView day={period.start} lanes={dayLanes} embedded />
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
