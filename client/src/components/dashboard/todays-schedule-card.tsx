"use client";

import Link from "next/link";
import { Calendar } from "@/components/ui/icons";
import { surfaceClassName, badgeBaseClassName, cn } from "@/components/ui/styles";
import { formatBadgeLabel } from "@/components/ui/status-badge";

export type ScheduleItem = {
  id: string;
  customerName: string;
  customerInitials: string;
  address?: string;
  jobType: string;
  status: string;
  time: string;
  assignee?: string;
};

const statusBadgeClassName: Record<string, string> = {
  SCHEDULED: "bg-[var(--color-brand-surface)] text-[var(--color-brand)] border-[var(--color-app-border)]",
  IN_PROGRESS: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-app-border)]",
  PENDING_REVIEW: "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-app-border)]",
  COMPLETED: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-app-border)]",
  NEW: "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-app-border)]",
  CANCELLED: "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)] border-[var(--color-app-border)]",
};

const avatarColors = [
  "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
  "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  "bg-[var(--color-brand-surface)] text-[var(--color-brand)]",
  "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

type TodaysScheduleCardProps = {
  items: ScheduleItem[];
  loading?: boolean;
};

export function TodaysScheduleCard({ items, loading = false }: TodaysScheduleCardProps) {
  return (
    <div className={`${surfaceClassName} flex flex-1 flex-col overflow-hidden p-0`}>
      <div className="flex items-center justify-between border-b border-[var(--color-app-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <Calendar className="h-[18px] w-[18px]" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[var(--color-text)]">Today&apos;s Schedule</h2>
            <span className={cn(badgeBaseClassName, "border-[var(--color-app-border)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]")}>
              {items.length}
            </span>
          </div>
        </div>
        <Link
          href="/jobs"
          className="text-sm font-semibold text-[var(--color-brand)] transition-colors hover:text-[var(--color-brand-strong)]"
        >
          View All
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-[var(--color-text-muted)]">Loading schedule...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-[var(--color-text-muted)]">No jobs scheduled for today</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--color-app-border)]">
              <tr className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                <th className="min-w-[200px] px-4 py-2.5">Customer</th>
                <th className="min-w-[160px] px-4 py-2.5">Job Type</th>
                <th className="w-32 px-4 py-2.5">Status</th>
                <th className="min-w-[130px] px-4 py-2.5">Crew</th>
                <th className="w-24 px-4 py-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-app-border)]">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="group bg-[var(--color-app-panel)] transition hover:bg-[var(--color-app-panel-muted)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          avatarColor(item.customerName),
                        )}
                      >
                        {item.customerInitials}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--color-text)]">{item.customerName}</div>
                        {item.address ? (
                          <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.address}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/jobs/${item.id}`}
                      className="font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand)]"
                    >
                      {item.jobType}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        badgeBaseClassName,
                        statusBadgeClassName[item.status] ?? "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)] border-[var(--color-app-border)]",
                      )}
                    >
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {formatBadgeLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        item.assignee
                          ? "text-[var(--color-text-secondary)]"
                          : "text-[var(--color-warning)]",
                      )}
                    >
                      {item.assignee ?? "Unassigned"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm font-medium text-[var(--color-text-secondary)]">{item.time}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
