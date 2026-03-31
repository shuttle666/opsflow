import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewJobPage from "@/app/jobs/new/page";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { createJobRequest } from "@/features/job/job-api";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams("customerId=customer-1"),
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

vi.mock("@/features/customer/customer-api", () => ({
  getCustomerDetailRequest: vi.fn(),
  listCustomersRequest: vi.fn(),
}));

vi.mock("@/features/job/job-api", () => ({
  createJobRequest: vi.fn(),
}));

describe("new job page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
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

  it("loads customers and submits a new job", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [
        {
          id: "customer-1",
          name: "Noah Thompson",
          phone: null,
          email: null,
          address: null,
          notes: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(createJobRequest).mockResolvedValue({
      id: "job-1",
      title: "Leaking kitchen tap",
      status: "NEW",
      scheduledAt: null,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      customer: {
        id: "customer-1",
        name: "Noah Thompson",
      },
    });

    const user = userEvent.setup();
    render(<NewJobPage />);

    const customerSelect = await screen.findByLabelText("Customer");
    expect(customerSelect).toHaveValue("customer-1");

    await user.type(screen.getByPlaceholderText("Leaking kitchen tap"), "Leaking kitchen tap");
    await user.type(
      screen.getByPlaceholderText("Describe the issue or requested work"),
      "Tap leaking overnight.",
    );
    await user.type(screen.getByLabelText("Scheduled time"), "2026-03-30T12:30");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(vi.mocked(createJobRequest)).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          customerId: "customer-1",
          title: "Leaking kitchen tap",
          description: "Tap leaking overnight.",
        }),
      );
      expect(pushMock).toHaveBeenCalledWith("/jobs/job-1");
    });
  });
});
