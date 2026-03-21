import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobAssignmentCard } from "@/components/job/job-assignment-card";
import {
  assignJobRequest,
  unassignJobRequest,
} from "@/features/job/job-api";
import { listMembershipsRequest } from "@/features/membership";
import { useAuthStore } from "@/store/auth-store";
import type { JobDetail } from "@/types/job";

vi.mock("@/features/membership", () => ({
  listMembershipsRequest: vi.fn(),
}));

vi.mock("@/features/job/job-api", async () => {
  const actual = await vi.importActual<typeof import("@/features/job/job-api")>(
    "@/features/job/job-api",
  );
  return {
    ...actual,
    assignJobRequest: vi.fn(),
    unassignJobRequest: vi.fn(),
  };
});

const baseJob: JobDetail = {
  id: "job-1",
  title: "Assigned visit",
  description: "Desc",
  status: "NEW",
  scheduledAt: null,
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
};

describe("JobAssignmentCard", () => {
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

  it("assigns and unassigns jobs for owner and manager roles", async () => {
    vi.mocked(listMembershipsRequest).mockResolvedValue({
      items: [
        {
          id: "membership-1",
          userId: "staff-1",
          displayName: "Sam Staff",
          email: "sam@acme.example",
          role: "STAFF",
          status: "ACTIVE",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(assignJobRequest).mockResolvedValue({
      ...baseJob,
      assignedTo: {
        id: "staff-1",
        displayName: "Sam Staff",
        email: "sam@acme.example",
      },
    });
    vi.mocked(unassignJobRequest).mockResolvedValue(baseJob);

    const onJobChange = vi.fn();
    const user = userEvent.setup();
    render(<JobAssignmentCard job={baseJob} onJobChange={onJobChange} />);

    await screen.findByText("Sam Staff (sam@acme.example)");
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(assignJobRequest).toHaveBeenCalledWith("access-token", "job-1", {
        membershipId: "membership-1",
      });
    });

    render(
      <JobAssignmentCard
        job={{
          ...baseJob,
          assignedTo: {
            id: "staff-1",
            displayName: "Sam Staff",
            email: "sam@acme.example",
          },
        }}
        onJobChange={onJobChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Unassign" }));
    await waitFor(() => {
      expect(unassignJobRequest).toHaveBeenCalledWith("access-token", "job-1");
    });
  });
});
