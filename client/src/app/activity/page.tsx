"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ActivityLogCard } from "@/components/activity/activity-log-card";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { SummaryCard } from "@/components/ui/info-cards";
import { subtleButtonClassName } from "@/components/ui/styles";
import { useActivityFeedQuery } from "@/features/activity/activity-queries";
import {
  DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
  PAGINATED_LIST_BOTTOM_GAP,
  useAdaptivePageSize,
} from "@/hooks/use-adaptive-page-size";
import { getApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipRole } from "@/types/auth";
import type { ActivityFeedItem } from "@/types/activity";
import type { PaginationMeta } from "@/types/customer";

const ACTIVITY_ROW_HEIGHT_PX = 65;

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
  const [page, setPage] = useState(1);

  const allowReview = canReviewActivity(currentTenant?.role);
  const emptyPagination: PaginationMeta = {
    page: 1,
    pageSize: DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
    total: 0,
    totalPages: 1,
  };
  const {
    containerRef: activityListAreaRef,
    hasMeasured: hasMeasuredPageSize,
    itemAreaRef: activityListContentRef,
    pageSize: adaptivePageSize,
  } = useAdaptivePageSize<HTMLDivElement, HTMLDivElement>({
    bottomGap: PAGINATED_LIST_BOTTOM_GAP,
    itemHeight: ACTIVITY_ROW_HEIGHT_PX,
    dependencies: [],
  });
  const activityQuery = useActivityFeedQuery(
    { page, pageSize: adaptivePageSize },
    allowReview && hasMeasuredPageSize,
  );
  const items = mapItems(activityQuery.data?.items ?? []);
  const pagination = activityQuery.data?.pagination ?? emptyPagination;
  const isLoading = !hasMeasuredPageSize || activityQuery.isLoading;
  const error = activityQuery.error
    ? getApiErrorView(activityQuery.error, "Failed to load activity log.")
    : null;

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

            <div ref={activityListAreaRef}>
              {!error && !isLoading && items.length === 0 ? (
                <EmptyStatePanel
                  title="No activity recorded"
                  description="System and workflow events will appear here once the workspace becomes active."
                />
              ) : (
                <ActivityLogCard
                  contentRef={activityListContentRef}
                  items={items}
                  loading={isLoading}
                />
              )}
            </div>

            <div className="flex flex-col gap-3 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
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
