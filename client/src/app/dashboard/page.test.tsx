import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { useAuthStore } from "@/store/auth-store";
import { listJobsRequest } from "@/features/job/job-api";

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

vi.mock("@/features/job/job-api", () => ({
  listJobsRequest: vi.fn(),
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

  it("loads and renders today's schedule without the activity card", async () => {
    vi.mocked(listJobsRequest).mockResolvedValue({
      items: [
        {
          id: "job-1",
          title: "Boiler inspection",
          serviceAddress: "18 Collins Street, Melbourne VIC 3000",
          status: "SCHEDULED",
          scheduledStartAt: "2026-03-20T01:30:00.000Z",
          scheduledEndAt: "2026-03-20T02:30:00.000Z",
          createdAt: "2026-03-20T00:30:00.000Z",
          updatedAt: "2026-03-20T00:30:00.000Z",
          assignedToName: "Ivy Dispatcher",
          customer: {
            id: "customer-1",
            name: "Noah Thompson",
          },
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<DashboardPage />);

    expect(await screen.findByText("Boiler inspection")).toBeInTheDocument();
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });
});
