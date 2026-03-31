"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { AgentChat } from "./agent-chat";

export default function AgentPage() {
  return (
    <AppShell title="AI Dispatch" description="Natural language operations assistant">
      <AuthGuard>
        <AgentChat />
      </AuthGuard>
    </AppShell>
  );
}
