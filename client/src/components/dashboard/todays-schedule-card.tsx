"use client";

import Link from "next/link";
import { Calendar } from "@/components/ui/icons";
import { surfaceClassName, badgeBaseClassName, cn } from "@/components/ui/styles";

export type ScheduleItem = {
  id: string;
  customerName: string;
  customerInitials: string;
  address?: string;
  jobType: string;
  status: string;
  time: string;
};

const statusBadgeClassName: Record<string, string> = {
  SCHEDULED: "bg-cyan-50 text-cyan-700 border-cyan-100",
  IN_PROGRESS: "bg-amber-50 text-amber-600 border-amber-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  NEW: "bg-sky-50 text-sky-600 border-sky-100",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

const avatarColors = [
  "bg-sky-100 text-sky-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
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
    <div className={`${surfaceClassName} flex flex-1 flex-col p-6`}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Calendar className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Today&apos;s Schedule</h2>
        </div>
        <Link
          href="/jobs"
          className="text-sm font-semibold text-sky-500 transition-colors hover:text-sky-600"
        >
          View All
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-slate-400">Loading schedule...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-slate-400">No jobs scheduled for today</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="min-w-[200px] px-4 pb-2">Customer</th>
                <th className="min-w-[160px] px-4 pb-2">Job Type</th>
                <th className="w-32 px-4 pb-2">Status</th>
                <th className="w-24 px-4 pb-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="group cursor-pointer rounded-2xl bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-100 hover:bg-slate-50 hover:shadow-md"
                >
                  <td className="rounded-l-2xl border-y border-l border-white px-4 py-4 group-hover:border-sky-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          avatarColor(item.customerName),
                        )}
                      >
                        {item.customerInitials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{item.customerName}</div>
                        {item.address ? (
                          <div className="mt-0.5 text-xs text-slate-500">{item.address}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                    <span className="font-medium text-slate-700">{item.jobType}</span>
                  </td>
                  <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                    <span
                      className={cn(
                        badgeBaseClassName,
                        statusBadgeClassName[item.status] ?? "bg-slate-100 text-slate-500 border-slate-200",
                      )}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="rounded-r-2xl border-y border-r border-white px-4 py-4 text-right group-hover:border-sky-100">
                    <span className="font-mono text-sm font-medium text-slate-600">{item.time}</span>
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
