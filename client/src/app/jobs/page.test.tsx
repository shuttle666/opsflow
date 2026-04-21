import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobsPage from "@/app/jobs/page";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { listJobsRequest } from "@/features/job/job-api";
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
  AppShell: ({
    children,
    actions,
  }: {
    children: ReactNode;
    actions?: ReactNode;
  }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/section-card", () => ({
  SectionCard: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/customer/customer-api", () => ({
  listCustomersRequest: vi.fn(),
}));

vi.mock("@/features/job/job-api", () => ({
  listJobsRequest: vi.fn(),
}));

describe("jobs page", () => {
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

  it("loads and renders jobs table", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    });
    vi.mocked(listJobsRequest).mockResolvedValue({
      items: [
        {
          id: "job-1",
          title: "Leaking kitchen tap",
          status: "NEW",
          scheduledStartAt: null,
          scheduledEndAt: null,
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

    render(<JobsPage />);

    expect(await screen.findByText("Leaking kitchen tap")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create job" })).toBeInTheDocument();
  });

  it("requests more jobs when the viewport can fit more rows", async () => {
    mockAdaptivePageSizeViewport({ top: 180, innerHeight: 1500 });
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    });
    vi.mocked(listJobsRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 22, total: 0, totalPages: 1 },
    });

    render(<JobsPage />);

    await waitFor(() => {
      expect(listJobsRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ pageSize: 22 }),
      );
    });
  });

  it("keeps at least ten jobs per page on short viewports", async () => {
    mockAdaptivePageSizeViewport({ top: 780, innerHeight: 800 });
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    });
    vi.mocked(listJobsRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    render(<JobsPage />);

    await waitFor(() => {
      expect(listJobsRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ pageSize: 10 }),
      );
    });
  });

  it("applies filters and hides create button for staff", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [
        {
          id: "customer-1",
          name: "Noah Thompson",
          phone: null,
          email: null,
          address: null,
          notes: null,
          archivedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(listJobsRequest).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<JobsPage />);

    expect(
      screen.getByText(/Staff members work from the personal jobs view/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Open my assigned jobs")).toBeInTheDocument();
    expect(screen.queryByText("Create job")).not.toBeInTheDocument();
    expect(vi.mocked(listJobsRequest)).not.toHaveBeenCalled();
    expect(vi.mocked(listCustomersRequest)).not.toHaveBeenCalled();
  });
});
