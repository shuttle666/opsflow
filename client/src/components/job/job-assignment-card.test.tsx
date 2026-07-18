import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobAssignmentCard } from "@/components/job/job-assignment-card";
import {
  assignJobRequest,
  unassignJobRequest,
} from "@/features/job/job-api";
import { listMembershipsRequest } from "@/features/membership/membership-api";
import { useAuthStore } from "@/store/auth-store";
import type { JobDetail } from "@/types/job";

vi.mock("@/features/membership/membership-api", () => ({
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
  serviceAddress: "18 Collins Street, Melbourne VIC 3000",
  status: "NEW",
  scheduledStartAt: null,
  scheduledEndAt: null,
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
      summary: { total: 1, active: 1, invited: 0, disabled: 0 },
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
    await user.selectOptions(
      screen.getByLabelText("Assign to staff"),
      "membership-1",
    );
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

  it("never falls back to the first result when the current assignee is not in the page", async () => {
    vi.mocked(listMembershipsRequest).mockResolvedValue({
      items: [
        {
          id: "membership-other",
          userId: "staff-other",
          displayName: "Other Staff",
          email: "other@acme.example",
          role: "STAFF",
          status: "ACTIVE",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 51, totalPages: 6 },
      summary: { total: 51, active: 51, invited: 0, disabled: 0 },
    });

    render(
      <JobAssignmentCard
        job={{
          ...baseJob,
          assignedTo: {
            id: "staff-51",
            displayName: "Fifty-first Staff",
            email: "staff51@acme.example",
          },
        }}
        onJobChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Other Staff (other@acme.example)")).toBeInTheDocument();
    expect(screen.getByLabelText("Assign to staff")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(assignJobRequest).not.toHaveBeenCalled();
  });

  it("searches for and assigns a staff member beyond the first page", async () => {
    const distantStaff = {
      id: "membership-51",
      userId: "staff-51",
      displayName: "Fifty-first Staff",
      email: "staff51@acme.example",
      role: "STAFF" as const,
      status: "ACTIVE" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
    };
    vi.mocked(listMembershipsRequest).mockImplementation(async (_token, input) =>
      input.q === "staff51@acme.example"
        ? {
            items: [distantStaff],
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
            summary: { total: 51, active: 51, invited: 0, disabled: 0 },
          }
        : {
            items: [],
            pagination: { page: 1, pageSize: 10, total: 51, totalPages: 6 },
            summary: { total: 51, active: 51, invited: 0, disabled: 0 },
          },
    );
    vi.mocked(assignJobRequest).mockResolvedValue({
      ...baseJob,
      assignedTo: {
        id: distantStaff.userId,
        displayName: distantStaff.displayName,
        email: distantStaff.email,
      },
    });

    const user = userEvent.setup();
    render(<JobAssignmentCard job={baseJob} onJobChange={vi.fn()} />);

    await user.type(
      await screen.findByLabelText("Assign to staff search"),
      "staff51@acme.example",
    );
    await user.click(
      screen.getByRole("button", { name: "Search Assign to staff" }),
    );

    await waitFor(() => {
      expect(listMembershipsRequest).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          q: "staff51@acme.example",
          pageSize: 10,
        }),
      );
    });
    await user.selectOptions(
      await screen.findByLabelText("Assign to staff"),
      "membership-51",
    );
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(assignJobRequest).toHaveBeenCalledWith("access-token", "job-1", {
        membershipId: "membership-51",
      });
    });
  });
});
