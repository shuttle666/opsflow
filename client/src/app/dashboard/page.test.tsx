import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { useAuthStore } from "@/store/auth-store";
import { getDashboardSummaryRequest } from "@/features/dashboard";
import type { DashboardSummary } from "@/types/dashboard";

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

vi.mock("@/features/dashboard", () => ({
  getDashboardSummaryRequest: vi.fn(),
}));

describe("dashboard page", () => {
  function summaryFixture(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
    return {
      date: "2026-05-02",
      rangeStart: "2026-05-02T00:00:00.000Z",
      rangeEnd: "2026-05-03T00:00:00.000Z",
      generatedAt: "2026-05-02T00:00:00.000Z",
      metrics: {
        todayJobs: 6,
        scheduledRows: 6,
        assignedJobs: 5,
        pendingReview: 2,
        unassignedJobs: 1,
        activeCrewScheduled: 3,
        activeCrewTotal: 4,
        needsAttention: 2,
        conflictCount: 0,
      },
      schedulePreview: [
        {
          id: "job-1",
          customerName: "Noah Thompson",
          customerInitials: "NT",
          serviceAddress: "18 Collins Street, Melbourne VIC 3000",
          jobType: "Boiler inspection",
          status: "SCHEDULED",
          scheduledStartAt: "2026-05-02T01:30:00.000Z",
          scheduledEndAt: "2026-05-02T02:30:00.000Z",
          assignee: "Ivy Dispatcher",
          hasConflict: false,
        },
      ],
      attentionItems: [
        {
          id: "job-2",
          title: "Needs review",
          customer: "Mia Chen",
          status: "PENDING_REVIEW",
          assignee: "Ivy Dispatcher",
          reason: "PENDING_REVIEW",
        },
        {
          id: "job-3",
          title: "Unassigned roof leak",
          customer: "Samuel Brooks",
          status: "SCHEDULED",
          reason: "UNASSIGNED",
        },
      ],
      ...overrides,
    };
  }

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

  it("loads backend dashboard summary metrics and schedule preview", async () => {
    vi.mocked(getDashboardSummaryRequest).mockResolvedValue(summaryFixture());

    render(<DashboardPage />);

    expect(await screen.findAllByText("Boiler inspection")).not.toHaveLength(0);
    expect(screen.getByText("You have 6 jobs scheduled today")).toBeInTheDocument();
    expect(screen.getAllByText("6")).not.toHaveLength(0);
    expect(screen.getAllByText("2")).not.toHaveLength(0);
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Unassigned roof leak")).toBeInTheDocument();
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
    expect(getDashboardSummaryRequest).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        timezoneOffsetMinutes: expect.any(Number),
      }),
    );
  });

  it("renders all-clear when the backend summary has no attention items", async () => {
    vi.mocked(getDashboardSummaryRequest).mockResolvedValue(
      summaryFixture({
        metrics: {
          todayJobs: 0,
          scheduledRows: 0,
          assignedJobs: 0,
          pendingReview: 0,
          unassignedJobs: 0,
          activeCrewScheduled: 0,
          activeCrewTotal: 4,
          needsAttention: 0,
          conflictCount: 0,
        },
        schedulePreview: [],
        attentionItems: [],
      }),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
  });

  it("keeps the AI planner entry visible for managers and owners", async () => {
    vi.mocked(getDashboardSummaryRequest).mockResolvedValue(summaryFixture());
    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "MANAGER",
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByText("Plan with AI")).toBeInTheDocument();
  });

  it("falls back to an empty dashboard when the summary request fails", async () => {
    vi.mocked(getDashboardSummaryRequest).mockRejectedValue(new Error("API failed"));

    render(<DashboardPage />);

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("You have 0 jobs scheduled today")).toBeInTheDocument();
  });
});
