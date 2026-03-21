import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { listActivityFeedRequest } from "@/features/activity/activity-api";
import { useAuthStore } from "@/store/auth-store";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/auth/invitation-create-card", () => ({
  InvitationCreateCard: () => <div>Create invitation card</div>,
}));

vi.mock("@/components/auth/invitation-inbox-card", () => ({
  InvitationInboxCard: () => <div>Invitation inbox</div>,
}));

vi.mock("@/features/activity/activity-api", () => ({
  listActivityFeedRequest: vi.fn(),
}));

describe("dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@acme.example",
        displayName: "Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "OWNER",
      },
      availableTenants: [],
      accessToken: "access-token",
      refreshToken: "refresh-token",
      withAccessTokenRetry: async <T,>(request: (accessToken: string) => Promise<T>) =>
        request("access-token"),
    });
  });

  it("loads and renders recent activity from the live feed endpoint", async () => {
    vi.mocked(listActivityFeedRequest).mockResolvedValue({
      items: [
        {
          id: "activity-1",
          title: "Status moved to COMPLETED",
          description: "Owner completed a job.",
          timestamp: "2026-03-20T01:30:00.000Z",
          tone: "success",
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<DashboardPage />);

    expect(await screen.findByText("Status moved to COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("Owner completed a job.")).toBeInTheDocument();
  });
});
