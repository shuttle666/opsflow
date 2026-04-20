import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { BellRing, CheckCircle2, FileClock, History } from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { cn, surfaceClassName } from "@/components/ui/styles";
import type { ActivityFeedItem } from "@/types/activity";

type ActivityLogCardProps = {
  items: ActivityFeedItem[];
  loading?: boolean;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function toneClassName(tone: ActivityFeedItem["tone"]) {
  switch (tone) {
    case "success":
      return "bg-[var(--color-success-soft)] text-[var(--color-success)]";
    case "warning":
      return "bg-[var(--color-warning-soft)] text-[var(--color-warning)]";
    case "brand":
      return "bg-[var(--color-brand-soft)] text-[var(--color-brand)]";
    default:
      return "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]";
  }
}

function iconForTone(tone: ActivityFeedItem["tone"]) {
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

export function ActivityLogCard({
  items,
  loading = false,
  title = "Activity Log",
  emptyTitle = "No activity yet",
  emptyDescription = "Tenant events will appear here as work progresses.",
}: ActivityLogCardProps) {
  return (
    <div className={cn(surfaceClassName, "flex flex-col overflow-hidden p-0")}>
      <div className="flex items-center gap-3 border-b border-[var(--color-app-border)] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <History className="h-[18px] w-[18px]" />
        </div>
        <h2 className="text-[15px] font-bold text-[var(--color-text)]">{title}</h2>
      </div>

      {loading ? (
        <div className="p-4">
          <LoadingPanel label="Loading activity log..." compact />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="p-4">
          <EmptyStatePanel
            compact
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="flex flex-col divide-y divide-[var(--color-app-border)] overflow-y-auto">
          {items.map((item) => {
            const Icon = iconForTone(item.tone);

            return (
              <div
                key={item.id}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-app-panel-muted)]"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
                    toneClassName(item.tone),
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
                    {item.description}
                  </span>
                </div>
                <span className="mt-1 whitespace-nowrap font-mono text-[10px] font-medium text-[var(--color-text-muted)]">
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
