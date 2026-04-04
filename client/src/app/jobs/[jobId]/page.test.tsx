import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JobDetailPage from "@/app/jobs/[jobId]/page";
import {
  getJobDetailRequest,
  getJobHistoryRequest,
  listJobEvidenceRequest,
  transitionJobStatusRequest,
} from "@/features/job/job-api";
import { useAuthStore } from "@/store/auth-store";
import type { JobDetail, JobHistoryResult } from "@/types/job";

const baseJob: JobDetail = {
  id: "job-1",
  title: "Leaking kitchen tap",
  description: "Tap leaking overnight.",
  status: "NEW",
  scheduledStartAt: null,
  scheduledEndAt: null,
  createdAt: "2026-03-20T00:00:00.000Z",
  updatedAt: "2026-03-20T00:00:00.000Z",
  customer: {
    id: "customer-1",
    name: "Noah Thompson",
    phone: "0412 000 001",
    email: "noah@example.com",
  },
  createdBy: {
    id: "user-1",
    displayName: "Owner",
    email: "owner@acme.example",
  },
  assignedTo: {
    id: "staff-1",
    displayName: "Sam Staff",
    email: "sam@acme.example",
  },
};

const baseHistory: JobHistoryResult = {
  history: [],
  allowedTransitions: ["SCHEDULED", "CANCELLED"],
};

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
  useParams: () => ({
    jobId: "job-1",
  }),
}));

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/detail-layout", () => ({
  DetailLayout: ({
    main,
    sidebar,
  }: {
    main: ReactNode;
    sidebar: ReactNode;
  }) => (
    <div>
      <div>{main}</div>
      <aside>{sidebar}</aside>
    </div>
  ),
}));

vi.mock("@/components/job/job-evidence-panel", () => ({
  JobEvidencePanel: () => <div>Job evidence panel</div>,
}));

vi.mock("@/components/job/job-assignment-card", () => ({
  JobAssignmentCard: () => <div>Assignment card</div>,
}));

vi.mock("@/features/job/job-api", async () => {
  const actual = await vi.importActual<typeof import("@/features/job/job-api")>(
    "@/features/job/job-api",
  );
  return {
    ...actual,
    getJobDetailRequest: vi.fn(),
    getJobHistoryRequest: vi.fn(),
    listJobEvidenceRequest: vi.fn(),
    transitionJobStatusRequest: vi.fn(),
  };
});

describe("job detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJobDetailRequest).mockResolvedValue(baseJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue(baseHistory);
    vi.mocked(listJobEvidenceRequest).mockResolvedValue([]);
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

  it("loads real workflow data and submits a valid transition", async () => {
    vi.mocked(transitionJobStatusRequest).mockResolvedValue({
      job: {
        ...baseJob,
        status: "SCHEDULED",
        updatedAt: "2026-03-20T01:00:00.000Z",
      },
      historyEntry: {
        id: "history-1",
        fromStatus: "NEW",
        toStatus: "SCHEDULED",
        reason: null,
        changedAt: "2026-03-20T01:00:00.000Z",
        changedBy: {
          id: "user-1",
          displayName: "Owner",
          email: "owner@acme.example",
        },
      },
      allowedTransitions: ["IN_PROGRESS", "CANCELLED"],
    });

    const user = userEvent.setup();
    render(<JobDetailPage />);

    expect(await screen.findByText("Move to scheduled")).toBeInTheDocument();
    expect(screen.getByText("Job evidence panel")).toBeInTheDocument();
    expect(screen.getByText("Job created by Owner.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move to scheduled" }));

    await waitFor(() => {
      expect(transitionJobStatusRequest).toHaveBeenCalledWith("access-token", "job-1", {
        toStatus: "SCHEDULED",
      });
    });

    expect(await screen.findByText("Job moved to Scheduled.")).toBeInTheDocument();
    expect(screen.getByText("Current status")).toBeInTheDocument();
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
  });

  it("keeps workflow read-only for staff on jobs not assigned to them", async () => {
    useAuthStore.setState({
      user: {
        id: "staff-2",
        email: "staff2@acme.example",
        displayName: "Other Staff",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<JobDetailPage />);

    expect(await screen.findByText("Read-only workflow")).toBeInTheDocument();
    expect(
      screen.getByText("Your current role can review this workflow but cannot advance this job."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Move to scheduled")).not.toBeInTheDocument();
  });
});
