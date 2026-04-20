import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SchedulePage from "@/app/schedule/page";
import { getScheduleRangeRequest } from "@/features/job";
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
    getScheduleRangeRequest: vi.fn(),
  };
});

vi.mock("@/features/membership", () => ({
  listMembershipsRequest: vi.fn(),
}));

const dayMs = 24 * 60 * 60 * 1000;

function dateTodayAt(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createScheduleResult() {
  return {
    rangeStart: dateTodayAt(0),
    rangeEnd: dateTodayAt(23),
    totalJobs: 2,
    conflictCount: 1,
    lanes: [
      {
        key: "user-1",
        label: "Sam Staff",
        membershipId: "membership-1",
        userId: "user-1",
        hasConflict: true,
        jobs: [
          {
            id: "job-1",
            title: "Assigned visit",
            status: "SCHEDULED" as const,
            scheduledStartAt: dateTodayAt(9),
            scheduledEndAt: dateTodayAt(10),
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
          {
            id: "job-2",
            title: "Conflict visit",
            status: "SCHEDULED" as const,
            scheduledStartAt: dateTodayAt(9),
            scheduledEndAt: dateTodayAt(11),
            hasConflict: true,
            customer: {
              id: "customer-2",
              name: "Olivia Davis",
            },
            assignedTo: {
              id: "user-1",
              displayName: "Sam Staff",
              email: "sam@acme.example",
            },
          },
        ],
      },
      {
        key: "unassigned",
        label: "Unassigned",
        hasConflict: false,
        jobs: [],
      },
    ],
  };
}

function createEmptyScheduleResult() {
  const result = createScheduleResult();

  return {
    ...result,
    totalJobs: 0,
    conflictCount: 0,
    lanes: result.lanes.map((lane) => ({
      ...lane,
      hasConflict: false,
      jobs: [],
    })),
  };
}

describe("schedule page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getScheduleRangeRequest).mockResolvedValue(createScheduleResult());
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

  it("defaults to a read-only personal week schedule for staff", async () => {
    render(<SchedulePage />);

    expect(await screen.findByText("My Schedule")).toBeInTheDocument();
    expect(screen.getByText("Your assigned jobs across the selected period.")).toBeInTheDocument();
    expect(screen.getByText("Week view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
    expect(screen.getAllByText("Assigned visit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Conflict").length).toBeGreaterThan(0);
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan with AI")).not.toBeInTheDocument();
    expect(listMembershipsRequest).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          rangeStart: expect.any(String),
          rangeEnd: expect.any(String),
        }),
      );
    });

    const requestInput = vi.mocked(getScheduleRangeRequest).mock.calls[0]?.[1];
    expect(requestInput?.assigneeId).toBeUndefined();
    const weekDuration =
      new Date(requestInput!.rangeEnd).getTime() - new Date(requestInput!.rangeStart).getTime();
    expect(weekDuration).toBeGreaterThan(6 * dayMs);
    expect(weekDuration).toBeLessThan(8 * dayMs);
  });

  it("moves by one week with previous and next buttons", async () => {
    const user = userEvent.setup();
    render(<SchedulePage />);

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(1);
    });

    const firstInput = vi.mocked(getScheduleRangeRequest).mock.calls[0]?.[1];
    await user.click(screen.getByRole("button", { name: "Previous week" }));

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(2);
    });
    const previousInput = vi.mocked(getScheduleRangeRequest).mock.calls[1]?.[1];
    const previousDelta =
      new Date(firstInput!.rangeStart).getTime() - new Date(previousInput!.rangeStart).getTime();
    expect(previousDelta).toBeGreaterThan(6 * dayMs);
    expect(previousDelta).toBeLessThan(8 * dayMs);

    await user.click(screen.getByRole("button", { name: "Next week" }));

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(3);
    });
    const nextInput = vi.mocked(getScheduleRangeRequest).mock.calls[2]?.[1];
    expect(new Date(nextInput!.rangeStart).getTime()).toBe(new Date(firstInput!.rangeStart).getTime());
  });

  it("restores a daily timeline view with day navigation", async () => {
    const user = userEvent.setup();
    render(<SchedulePage />);

    await screen.findByText("Week view");
    await user.click(screen.getByRole("button", { name: /^day$/i }));

    expect(await screen.findByText("Day view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next day" })).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getAllByText("Assigned visit").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(2);
    });
    const dayInput = vi.mocked(getScheduleRangeRequest).mock.calls[1]?.[1];
    const dayDuration =
      new Date(dayInput!.rangeEnd).getTime() - new Date(dayInput!.rangeStart).getTime();
    expect(dayDuration).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(dayDuration).toBeLessThan(25 * 60 * 60 * 1000);

    await user.click(screen.getByRole("button", { name: "Previous day" }));

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(3);
    });
    const previousDayInput = vi.mocked(getScheduleRangeRequest).mock.calls[2]?.[1];
    const previousDelta =
      new Date(dayInput!.rangeStart).getTime() - new Date(previousDayInput!.rangeStart).getTime();
    expect(previousDelta).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(previousDelta).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("hides empty staff lanes in day view", async () => {
    vi.mocked(getScheduleRangeRequest).mockResolvedValue(createEmptyScheduleResult());
    const user = userEvent.setup();
    render(<SchedulePage />);

    await screen.findByText("Week view");
    await user.click(screen.getByRole("button", { name: /^day$/i }));

    expect(await screen.findByText("No jobs scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Sam Staff")).not.toBeInTheDocument();
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("switches to a month grid with selected day details", async () => {
    const user = userEvent.setup();
    render(<SchedulePage />);

    await screen.findByText("Week view");
    await user.click(screen.getByRole("button", { name: /^month$/i }));

    expect(await screen.findByText("Month view")).toBeInTheDocument();
    expect(screen.getByText("Selected day")).toBeInTheDocument();
    expect(screen.getAllByText("Assigned visit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Conflict visit").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenCalledTimes(2);
    });
    const monthInput = vi.mocked(getScheduleRangeRequest).mock.calls[1]?.[1];
    const monthDays =
      (new Date(monthInput!.rangeEnd).getTime() - new Date(monthInput!.rangeStart).getTime()) /
      dayMs;
    expect(monthDays).toBeGreaterThanOrEqual(28);
    expect(monthDays).toBeLessThanOrEqual(42);
  });

  it("shows team controls for managers and sends assignee filters", async () => {
    const user = userEvent.setup();
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
    expect(screen.getByText("Team schedule for dispatch planning and conflict review.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assignee filter" })).toBeInTheDocument();
    expect(screen.getByText("Plan with AI")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assignee filter" }));
    await user.click(screen.getByRole("button", { name: "Sam Staff" }));

    await waitFor(() => {
      expect(getScheduleRangeRequest).toHaveBeenLastCalledWith(
        "access-token",
        expect.objectContaining({
          assigneeId: "user-1",
        }),
      );
    });
  });
});
