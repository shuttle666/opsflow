"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { InvitationCreateCard } from "@/components/auth/invitation-create-card";
import { InvitationInboxCard } from "@/components/auth/invitation-inbox-card";
import {
  Building2,
  CircleUserRound,
  Layers3,
  ShieldCheck,
} from "@/components/ui/icons";
import { AppShell } from "@/components/ui/app-shell";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { StatCard, SummaryCard } from "@/components/ui/info-cards";
import { secondaryButtonClassName } from "@/components/ui/styles";
import { listActivityFeedRequest } from "@/features/activity/activity-api";
import { useAuthStore } from "@/store/auth-store";
import type { ActivityFeedItemView } from "@/types/future-ui";

const dashboardCards = [
  {
    title: "Customer workspace",
    description: "Create and maintain the tenant customer directory.",
    href: "/customers",
    action: "Open customers",
  },
  {
    title: "Job workspace",
    description: "Track work orders, filters, and assignment-ready records.",
    href: "/jobs",
    action: "Open jobs",
  },
  {
    title: "Team workspace",
    description: "Manage members, invitations, and role visibility.",
    href: "/team",
    action: "Open team",
  },
];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const availableTenants = useAuthStore((state) => state.availableTenants);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [activityItems, setActivityItems] = useState<ActivityFeedItemView[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsActivityLoading(true);
      setActivityError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listActivityFeedRequest(accessToken, { page: 1, pageSize: 10 }),
        );

        if (!cancelled) {
          setActivityItems(
            result.items.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              timestamp: new Date(item.timestamp).toLocaleString(),
              tone: item.tone,
            })),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setActivityError(
            loadError instanceof Error ? loadError.message : "Failed to load activity feed.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsActivityLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [withAccessTokenRetry]);

  return (
    <AppShell
      title="Dashboard"
    >
      <AuthGuard>
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current role"
            value={currentTenant?.role ?? "-"}
            meta="Tenant scoped"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="brand"
          />
          <StatCard
            label="Active tenant"
            value={currentTenant?.tenantName ?? "-"}
            meta="Live context"
            icon={<Building2 className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="Accessible tenants"
            value={String(availableTenants.length || 0)}
            meta="Switcher ready"
            icon={<Layers3 className="h-5 w-5" />}
            tone="indigo"
          />
          <StatCard
            label="Signed in as"
            value={user?.displayName?.split(" ")[0] ?? "-"}
            meta={user?.email ?? "Workspace user"}
            icon={<CircleUserRound className="h-5 w-5" />}
            tone="warning"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
          <div className="space-y-5">
            <SummaryCard
              eyebrow="Workspace overview"
              title="Move through the core operating areas"
              description="Jump into the customer directory, jobs queue, or team access flow from one place."
            >
              <div className="space-y-3">
                {dashboardCards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="flex items-center justify-between rounded-[24px] border border-white/75 bg-white px-4 py-4 shadow-sm transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                    </div>
                    <span className={secondaryButtonClassName}>{card.action}</span>
                  </Link>
                ))}
              </div>
            </SummaryCard>

            {currentTenant?.role !== "STAFF" ? <InvitationCreateCard /> : null}
          </div>

          <div className="space-y-5">
            <InvitationInboxCard />
            {activityError ? <InlineErrorBanner message={activityError} /> : null}
            <ActivityFeedCard items={activityItems} loading={isActivityLoading} />
          </div>
        </div>
      </AuthGuard>
    </AppShell>
  );
}
