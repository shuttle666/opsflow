"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { GoldenDemoWelcome } from "@/features/golden-demo";
import { AgentChat } from "./agent-chat";

export default function AgentPage() {
  return (
    <AppShell title="AI Planner" description="Optimize scheduling, crew assignments, and route planning.">
      <AuthGuard>
        <GoldenDemoWelcome />
        <AgentChat />
      </AuthGuard>
    </AppShell>
  );
}
