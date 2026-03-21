import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyJobsPage from "@/app/jobs/my/page";
import { listMyJobsRequest } from "@/features/job/job-api";
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

  it("loads assigned jobs", async () => {
    vi.mocked(listMyJobsRequest).mockResolvedValue({
      items: [
        {
          id: "job-1",
          title: "Assigned visit",
          status: "SCHEDULED",
          scheduledAt: "2026-03-30T02:00:00.000Z",
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
});
