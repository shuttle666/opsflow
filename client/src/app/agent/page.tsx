"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { AgentChat } from "./agent-chat";

export default function AgentPage() {
  return (
    <AppShell title="Dispatch Planner" description="Natural-language planning with manager confirmation">
      <AuthGuard>
        <AgentChat />
      </AuthGuard>
    </AppShell>
  );
}
