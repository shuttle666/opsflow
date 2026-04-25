"use client";

import {
  Briefcase,
  Calendar,
  Sparkles,
  Users,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/styles";

const previewJobs = [
  {
    time: "10:00",
    title: "HVAC Maintenance",
    customer: "Sarah Jenkins",
    status: "Scheduled",
    tone: "brand",
  },
  {
    time: "11:30",
    title: "Plumbing Check",
    customer: "Mike Ross",
    status: "In progress",
    tone: "warning",
  },
  {
    time: "14:00",
    title: "Electrical Repair",
    customer: "Lisa Park",
    status: "Assigned",
    tone: "success",
  },
] as const;

const previewCrew = [
  { name: "MR", value: "3 jobs", color: "#7c5cfc" },
  { name: "TL", value: "2 jobs", color: "#f59e0b" },
  { name: "SK", value: "4 jobs", color: "#16a34a" },
] as const;

function toneClassName(tone: (typeof previewJobs)[number]["tone"]) {
  switch (tone) {
    case "warning":
      return "bg-[var(--color-warning-soft)] text-[var(--color-warning)]";
    case "success":
      return "bg-[var(--color-success-soft)] text-[var(--color-success)]";
    default:
      return "bg-[var(--color-brand-soft)] text-[var(--color-brand)]";
  }
}

export function ProductPreviewScene({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-floating)]",
        compact ? "p-4" : "p-5 sm:p-6",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-brand)]" />

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
            Today
          </p>
          <p className="mt-1 text-lg font-extrabold text-[var(--color-text)]">
            6 jobs scheduled
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[image:var(--gradient-brand)] text-xs font-extrabold text-white shadow-[0_12px_28px_-18px_var(--color-brand-glow)]">
          AI
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active jobs", value: "24", icon: Briefcase },
          { label: "Crew online", value: "12", icon: Users },
          { label: "Avg. route", value: "2h 15m", icon: Calendar },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {item.label}
                </span>
                <Icon className="h-4 w-4 text-[var(--color-brand)]" />
              </div>
              <p className="mt-2 text-2xl font-extrabold leading-none text-[var(--color-text)]">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_13rem]">
        <div className="overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)]">
          <div className="flex items-center justify-between border-b border-[var(--color-app-border)] px-4 py-3">
            <p className="text-sm font-bold text-[var(--color-text)]">
              Dispatch board
            </p>
            <span className="rounded-full bg-[var(--color-brand-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand)]">
              Live
            </span>
          </div>
          <div className="divide-y divide-[var(--color-app-border)]">
            {previewJobs.map((job) => (
              <div
                key={`${job.time}-${job.title}`}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <span className="font-mono text-xs font-medium text-[var(--color-text-muted)]">
                  {job.time}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {job.title}
                  </p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {job.customer}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    toneClassName(job.tone),
                  )}
                >
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
            <p className="text-sm font-bold text-[var(--color-text)]">
              Planner
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
            Route overlap down 18% after crew reassignment.
          </p>
          <div className="mt-4 space-y-3">
            {previewCrew.map((crew) => (
              <div key={crew.name} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: `${crew.color}20`,
                    color: crew.color,
                  }}
                >
                  {crew.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-app-border)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:
                        crew.name === "MR"
                          ? "72%"
                          : crew.name === "TL"
                            ? "56%"
                            : "84%",
                      background: crew.color,
                    }}
                  />
                </div>
                <span className="w-11 text-right text-[11px] font-medium text-[var(--color-text-muted)]">
                  {crew.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
