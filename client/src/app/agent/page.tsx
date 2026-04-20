"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { AgentChat } from "./agent-chat";

export default function AgentPage() {
  return (
    <AppShell title="AI Planner" description="Optimize scheduling, crew assignments, and route planning.">
      <AuthGuard>
        <AgentChat />
      </AuthGuard>
    </AppShell>
  );
}
