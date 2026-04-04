import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SchedulePage from "@/app/schedule/page";
import { getScheduleDayRequest } from "@/features/job";
import { listMembershipsRequest } from "@/features/membership";
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
  AppShell: ({
    children,
    title,
    description,
    actions,
  }: {
    children: ReactNode;
    title: string;
    description?: string;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/job", async () => {
  const actual = await vi.importActual<typeof import("@/features/job")>("@/features/job");
  return {
    ...actual,
    getScheduleDayRequest: vi.fn(),
  };
});

vi.mock("@/features/membership", () => ({
  listMembershipsRequest: vi.fn(),
}));

const scheduleResult = {
  date: "2026-04-04",
  rangeStart: "2026-04-03T13:30:00.000Z",
  rangeEnd: "2026-04-04T13:30:00.000Z",
  totalJobs: 1,
  conflictCount: 0,
  lanes: [
    {
      key: "user-1",
      label: "Sam Staff",
      membershipId: "membership-1",
      userId: "user-1",
      hasConflict: false,
      jobs: [
        {
          id: "job-1",
          title: "Assigned visit",
          status: "SCHEDULED" as const,
          scheduledStartAt: "2026-04-04T00:30:00.000Z",
          scheduledEndAt: "2026-04-04T01:30:00.000Z",
          hasConflict: false,
          customer: {
            id: "customer-1",
            name: "Noah Thompson",
          },
          assignedTo: {
            id: "user-1",
            displayName: "Sam Staff",
            email: "sam@acme.example",
          },
        },
      ],
    },
  ],
};

describe("schedule page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getScheduleDayRequest).mockResolvedValue(scheduleResult);
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "sam@acme.example",
        displayName: "Sam Staff",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
      availableTenants: [],
      accessToken: "access-token",
      refreshToken: "refresh-token",
      withAccessTokenRetry: async <T,>(request: (accessToken: string) => Promise<T>) =>
        request("access-token"),
    });
  });

  it("shows a read-only personal schedule for staff", async () => {
    render(<SchedulePage />);

    expect(await screen.findByText("My Schedule")).toBeInTheDocument();
    expect(screen.getByText("Read-only view of your assigned jobs for the selected day.")).toBeInTheDocument();
    expect(screen.getByText("Assigned visit")).toBeInTheDocument();
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan with AI")).not.toBeInTheDocument();
    expect(listMembershipsRequest).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getScheduleDayRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          date: expect.any(String),
          timezoneOffsetMinutes: expect.any(Number),
        }),
      );
    });
  });

  it("shows team controls for managers", async () => {
    vi.mocked(listMembershipsRequest).mockResolvedValue({
      items: [
        {
          id: "membership-1",
          userId: "user-1",
          displayName: "Sam Staff",
          email: "sam@acme.example",
          role: "STAFF",
          status: "ACTIVE",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });

    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "MANAGER",
      },
    });

    render(<SchedulePage />);

    expect(await screen.findByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Team day view for dispatch planning and conflict review.")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Plan with AI")).toBeInTheDocument();
  });
});
