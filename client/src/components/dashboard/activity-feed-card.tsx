import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { BellRing, CheckCircle2, FileClock, History } from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { SummaryCard } from "@/components/ui/info-cards";
import { cn } from "@/components/ui/styles";
import type { ActivityFeedItemView } from "@/types/future-ui";

type ActivityFeedCardProps = {
  items: ActivityFeedItemView[];
  loading?: boolean;
};

function toneClassName(tone: ActivityFeedItemView["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-600";
    case "warning":
      return "bg-amber-50 text-amber-600";
    case "brand":
      return "bg-cyan-50 text-cyan-700";
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
    <SummaryCard
      eyebrow="Activity feed"
      title="Recent activity"
      description="Recent workflow changes and audit events in the current tenant."
    >
      {loading ? <LoadingPanel label="Loading activity..." compact /> : null}

      {!loading && items.length === 0 ? (
        <EmptyStatePanel
          compact
          title="No activity yet"
          description="As members update jobs, assignments, and invitations, those actions will appear here."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {(() => {
                  const Icon = iconForTone(item.tone);

                  return (
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        toneClassName(item.tone),
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  );
                })()}

                <div
                  className="min-w-0 flex-1"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                      {item.timestamp}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SummaryCard>
  );
}
