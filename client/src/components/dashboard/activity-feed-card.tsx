import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { BellRing, CheckCircle2, FileClock, History } from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { cn, surfaceClassName } from "@/components/ui/styles";
import type { ActivityFeedItemView } from "@/types/future-ui";

type ActivityFeedCardProps = {
  items: ActivityFeedItemView[];
  loading?: boolean;
};

function toneClassName(tone: ActivityFeedItemView["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-500";
    case "warning":
      return "bg-amber-50 text-amber-500";
    case "brand":
      return "bg-sky-50 text-sky-500";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function iconForTone(tone: ActivityFeedItemView["tone"]) {
  switch (tone) {
    case "success":
      return CheckCircle2;
    case "warning":
      return BellRing;
    case "brand":
      return FileClock;
    default:
      return History;
  }
}

export function ActivityFeedCard({ items, loading = false }: ActivityFeedCardProps) {
  return (
    <div className={cn(surfaceClassName, "flex flex-col p-6")}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <History className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
      </div>

      {loading ? <LoadingPanel label="Loading activity..." compact /> : null}

      {!loading && items.length === 0 ? (
        <EmptyStatePanel
          compact
          title="No activity yet"
          description="Actions will appear here as work progresses."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          {items.map((item) => {
            const Icon = iconForTone(item.tone);

            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-[20px] border border-transparent p-4 transition-colors hover:border-sky-100 hover:bg-white"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm",
                    toneClassName(item.tone),
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 truncate">
                    {item.description}
                  </span>
                </div>
                <span className="mt-1 whitespace-nowrap font-mono text-[10px] font-medium text-slate-400">
                  {item.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
