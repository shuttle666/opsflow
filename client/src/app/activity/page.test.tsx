import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActivityPage from "@/app/activity/page";
import { listActivityFeedRequest } from "@/features/activity/activity-api";
import { useAuthStore } from "@/store/auth-store";
import {
  mockAdaptivePageSizeViewport,
  resetAdaptivePageSizeViewportMock,
} from "@/test/adaptive-page-size";

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/activity/activity-api", () => ({
  listActivityFeedRequest: vi.fn(),
}));

describe("activity page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdaptivePageSizeViewport({ top: 300, innerHeight: 900 });
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

  afterEach(() => {
    resetAdaptivePageSizeViewportMock();
  });

  it("loads and renders the activity log for owner and manager roles", async () => {
    vi.mocked(listActivityFeedRequest)
      .mockResolvedValueOnce({
        items: [
          {
            id: "activity-1",
            title: "Status moved to COMPLETED",
            description: "Owner completed a job.",
            timestamp: "2026-03-20T01:30:00.000Z",
            tone: "success",
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "activity-2",
            title: "Evidence added",
            description: "Owner uploaded a completion document.",
            timestamp: "2026-03-20T02:30:00.000Z",
            tone: "brand",
          },
        ],
        pagination: { page: 2, pageSize: 10, total: 2, totalPages: 2 },
      });

    const user = userEvent.setup();
    render(<ActivityPage />);

    expect(await screen.findByText("Status moved to COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("Recent tenant activity and system events for this workspace.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listActivityFeedRequest).toHaveBeenLastCalledWith("access-token", {
        page: 2,
        pageSize: 10,
      });
    });
    expect(await screen.findByText("Evidence added")).toBeInTheDocument();
  });

  it("requests more activity rows when the viewport can fit more rows", async () => {
    mockAdaptivePageSizeViewport({ top: 200, innerHeight: 1500 });
    vi.mocked(listActivityFeedRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 19, total: 0, totalPages: 1 },
    });

    render(<ActivityPage />);

    await waitFor(() => {
      expect(listActivityFeedRequest).toHaveBeenCalledWith("access-token", {
        page: 1,
        pageSize: 19,
      });
    });
  });

  it("keeps at least ten activity rows per page on short viewports", async () => {
    mockAdaptivePageSizeViewport({ top: 780, innerHeight: 800 });
    vi.mocked(listActivityFeedRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    render(<ActivityPage />);

    await waitFor(() => {
      expect(listActivityFeedRequest).toHaveBeenCalledWith("access-token", {
        page: 1,
        pageSize: 10,
      });
    });
  });

  it("blocks staff from activity log access", () => {
    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<ActivityPage />);

    expect(
      screen.getByText("Your current role cannot review tenant-wide activity in this workspace."),
    ).toBeInTheDocument();
    expect(listActivityFeedRequest).not.toHaveBeenCalled();
  });
});
