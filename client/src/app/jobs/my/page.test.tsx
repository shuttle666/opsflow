import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyJobsPage from "@/app/jobs/my/page";
import { listMyJobsRequest } from "@/features/job/job-api";
import { useAuthStore } from "@/store/auth-store";
import {
  mockAdaptivePageSizeViewport,
  resetAdaptivePageSizeViewportMock,
} from "@/test/adaptive-page-size";

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

vi.mock("@/components/ui/section-card", () => ({
  SectionCard: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/job/job-api", () => ({
  listMyJobsRequest: vi.fn(),
}));

describe("my jobs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdaptivePageSizeViewport({ top: 300, innerHeight: 900 });
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "staff@acme.example",
        displayName: "Staff",
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

  afterEach(() => {
    resetAdaptivePageSizeViewportMock();
  });

  it("loads assigned jobs", async () => {
    vi.mocked(listMyJobsRequest).mockResolvedValue({
      items: [
        {
          id: "job-1",
          title: "Assigned visit",
          status: "SCHEDULED",
          scheduledStartAt: "2026-03-30T02:00:00.000Z",
          scheduledEndAt: "2026-03-30T03:00:00.000Z",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
          customer: {
            id: "customer-1",
            name: "Noah Thompson",
          },
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<MyJobsPage />);

    expect(await screen.findByText("Assigned visit")).toBeInTheDocument();
    expect(screen.getByText("Noah Thompson")).toBeInTheDocument();
  });

  it("requests more assigned jobs when the viewport can fit more rows", async () => {
    mockAdaptivePageSizeViewport({ top: 180, innerHeight: 1500 });
    vi.mocked(listMyJobsRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 21, total: 0, totalPages: 1 },
    });

    render(<MyJobsPage />);

    await waitFor(() => {
      expect(listMyJobsRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ pageSize: 21 }),
      );
    });
  });

  it("keeps at least ten assigned jobs per page on short viewports", async () => {
    mockAdaptivePageSizeViewport({ top: 780, innerHeight: 800 });
    vi.mocked(listMyJobsRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    render(<MyJobsPage />);

    await waitFor(() => {
      expect(listMyJobsRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ pageSize: 10 }),
      );
    });
  });
});
