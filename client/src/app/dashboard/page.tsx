"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { InvitationCreateCard } from "@/components/auth/invitation-create-card";
import { InvitationInboxCard } from "@/components/auth/invitation-inbox-card";
import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { useAuthStore } from "@/store/auth-store";

const dashboardCards = [
  {
    title: "Customer operations",
    description: "Reserved for customer lists, details, and lifecycle workflows.",
  },
  {
    title: "Job coordination",
    description: "Ready for scheduling, status tracking, and dispatch surfaces.",
  },
  {
    title: "Team activity",
    description: "Intended for staff visibility, task ownership, and audit trails.",
  },
];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);

  return (
    <AppShell
      title="Operations dashboard"
      description="Protected workspace for authenticated users. Tenant switching and invitation acceptance are now part of the live auth flow."
    >
      <AuthGuard>
        <section className="grid gap-4 md:grid-cols-3">
          {dashboardCards.map((card) => (
            <SectionCard
              key={card.title}
              eyebrow="Future module"
              title={card.title}
              description={card.description}
            />
          ))}
        </section>

        <SectionCard
          eyebrow="Session context"
          title="Authenticated tenant scope"
          description="Current session details loaded from /auth/me."
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              User: <span className="font-semibold">{user?.displayName ?? "-"}</span>
            </p>
            <p>Email: {user?.email ?? "-"}</p>
            <p>
              Tenant:{" "}
              <span className="font-semibold">{currentTenant?.tenantName ?? "-"}</span>
            </p>
            <p>Role: {currentTenant?.role ?? "-"}</p>
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <InvitationInboxCard />
          <InvitationCreateCard />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
