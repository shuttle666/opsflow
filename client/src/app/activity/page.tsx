"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ActivityLogCard } from "@/components/activity/activity-log-card";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { SummaryCard } from "@/components/ui/info-cards";
import { subtleButtonClassName } from "@/components/ui/styles";
import { listActivityFeedRequest } from "@/features/activity/activity-api";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipRole } from "@/types/auth";
import type { ActivityFeedItem, ActivityFeedPagination } from "@/types/activity";

function canReviewActivity(role: MembershipRole | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function mapItems(items: ActivityFeedItem[]) {
  return items.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp).toLocaleString(),
  }));
}

export default function ActivityPage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [pagination, setPagination] = useState<ActivityFeedPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowReview = canReviewActivity(currentTenant?.role);

  useEffect(() => {
    if (!allowReview) {
      setItems([]);
      setPagination({
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listActivityFeedRequest(accessToken, { page, pageSize: 10 }),
        );

        if (!cancelled) {
          setItems(mapItems(result.items));
          setPagination(result.pagination);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load activity log.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowReview, page, withAccessTokenRetry]);

  return (
    <AppShell title="Activity Log">
      <AuthGuard>
        {!allowReview ? (
          <EmptyStatePanel
            title="Activity log is unavailable"
            description="Your current role cannot review tenant-wide activity in this workspace."
          />
        ) : (
          <div className="space-y-6">
            <SummaryCard
              eyebrow="Audit Trail"
              title="Activity Log"
              description="Recent tenant activity and system events for this workspace."
            />

            {error ? <InlineErrorBanner message={error} /> : null}

            {!error && !isLoading && items.length === 0 ? (
              <EmptyStatePanel
                title="No activity recorded"
                description="System and workflow events will appear here once the workspace becomes active."
              />
            ) : (
              <ActivityLogCard items={items} loading={isLoading} />
            )}

            <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Page {pagination.page} of {pagination.totalPages} | Total {pagination.total}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className={subtleButtonClassName}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(pagination.totalPages, current + 1))
                  }
                  className={subtleButtonClassName}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
