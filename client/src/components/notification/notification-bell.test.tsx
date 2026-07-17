import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/notification/notification-bell";
import {
  getUnreadNotificationCountRequest,
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "@/features/notification/notification-api";
import { useAuthStore } from "@/store/auth-store";
import { render } from "@/test/render";

vi.mock("@/features/notification/notification-api", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/features/notification/notification-api")
  >();

  return {
    ...original,
    getUnreadNotificationCountRequest: vi.fn(),
    listNotificationsRequest: vi.fn(),
    markAllNotificationsReadRequest: vi.fn(),
    markNotificationReadRequest: vi.fn(),
  };
});

const notification = {
  id: "notification-1",
  type: "JOB_STATUS_CHANGED" as const,
  title: "Job status changed",
  body: "Dishwasher repair moved to in progress.",
  metadata: {},
  readAt: null,
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUnreadNotificationCountRequest).mockResolvedValue({
      unreadCount: 1,
    });
    vi.mocked(listNotificationsRequest).mockResolvedValue({
      items: [notification],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
    vi.mocked(markNotificationReadRequest).mockResolvedValue({
      ...notification,
      readAt: "2026-04-01T00:01:00.000Z",
    });
    vi.mocked(markAllNotificationsReadRequest).mockResolvedValue({
      updatedCount: 1,
    });

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
      withAccessTokenRetry: async <T,>(
        request: (accessToken: string) => Promise<T>,
      ) => request("access-token"),
    });
  });

  it("loads the tenant-scoped preview and updates cached unread state", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    expect(await screen.findByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText("Job status changed")).toBeInTheDocument();
    expect(listNotificationsRequest).toHaveBeenCalledWith("access-token", {
      page: 1,
      pageSize: 10,
      status: "all",
    });

    await user.click(screen.getByRole("button", { name: /Job status changed/ }));

    await waitFor(() => {
      expect(markNotificationReadRequest).toHaveBeenCalledWith(
        "access-token",
        "notification-1",
      );
      expect(screen.getByText("All caught up")).toBeInTheDocument();
    });
  });
});
