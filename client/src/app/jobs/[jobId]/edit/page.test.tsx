import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditJobPage from "@/app/jobs/[jobId]/edit/page";
import { listCustomersRequest } from "@/features/customer/customer-api";
import {
  getJobDetailRequest,
  updateJobRequest,
} from "@/features/job/job-api";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({
    jobId: "job-1",
  }),
  useRouter: () => ({
    push: pushMock,
  }),
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
  getJobDetailRequest: vi.fn(),
  updateJobRequest: vi.fn(),
}));

describe("edit job page", () => {
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

  it("loads default values and submits updates", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [
        {
          id: "customer-1",
          name: "Noah Thompson",
          phone: null,
          email: null,
          notes: null,
          archivedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(getJobDetailRequest).mockResolvedValue({
      id: "job-1",
      title: "Leaking kitchen tap",
      description: "Tap leaking overnight.",
      serviceAddress: "18 Collins Street, Melbourne VIC 3000",
      status: "NEW",
      scheduledStartAt: "2026-03-30T02:00:00.000Z",
      scheduledEndAt: "2026-03-30T03:00:00.000Z",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      customer: {
        id: "customer-1",
        name: "Noah Thompson",
      },
      createdBy: {
        id: "user-1",
        displayName: "Owner",
        email: "owner@acme.example",
      },
    });
    vi.mocked(updateJobRequest).mockResolvedValue({
      id: "job-1",
      title: "Leaking kitchen tap updated",
      serviceAddress: "20 Collins Street, Melbourne VIC 3000",
      status: "NEW",
      scheduledStartAt: "2026-03-30T03:30:00.000Z",
      scheduledEndAt: "2026-03-30T04:30:00.000Z",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T01:00:00.000Z",
      customer: {
        id: "customer-1",
        name: "Noah Thompson",
      },
    });

    const user = userEvent.setup();
    render(<EditJobPage />);

    expect(await screen.findByDisplayValue("Leaking kitchen tap")).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue("Leaking kitchen tap");
    await user.clear(titleInput);
    await user.type(titleInput, "Leaking kitchen tap updated");

    const addressInput = screen.getByDisplayValue("18 Collins Street, Melbourne VIC 3000");
    await user.clear(addressInput);
    await user.type(addressInput, "20 Collins Street, Melbourne VIC 3000");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(vi.mocked(updateJobRequest)).toHaveBeenCalledWith(
        "access-token",
        "job-1",
        expect.objectContaining({
          customerId: "customer-1",
          title: "Leaking kitchen tap updated",
          serviceAddress: "20 Collins Street, Melbourne VIC 3000",
        }),
      );
      expect(pushMock).toHaveBeenCalledWith("/jobs/job-1");
    });
  });
});
