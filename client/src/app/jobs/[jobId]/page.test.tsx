import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JobDetailPage from "@/app/jobs/[jobId]/page";
import {
  approveJobCompletionReviewRequest,
  getJobDetailRequest,
  getJobHistoryRequest,
  getLatestJobCompletionReviewRequest,
  listJobEvidenceRequest,
  returnJobCompletionReviewRequest,
  submitJobCompletionReviewRequest,
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
    getLatestJobCompletionReviewRequest: vi.fn(),
    listJobEvidenceRequest: vi.fn(),
    submitJobCompletionReviewRequest: vi.fn(),
    approveJobCompletionReviewRequest: vi.fn(),
    returnJobCompletionReviewRequest: vi.fn(),
    transitionJobStatusRequest: vi.fn(),
  };
});

describe("job detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJobDetailRequest).mockResolvedValue(baseJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue(baseHistory);
    vi.mocked(getLatestJobCompletionReviewRequest).mockResolvedValue(null);
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

    expect(await screen.findByText("Job lifecycle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit status" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark scheduled" })).not.toBeInTheDocument();
    expect(screen.getByText("Job evidence panel")).toBeInTheDocument();
    expect(screen.getByText("Job created by Owner.")).toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit status" }));
    await user.click(screen.getByRole("button", { name: "Mark scheduled" }));

    await waitFor(() => {
      expect(transitionJobStatusRequest).toHaveBeenCalledWith("access-token", "job-1", {
        toStatus: "SCHEDULED",
      });
    });

    expect(await screen.findByText("Job moved to Scheduled.")).toBeInTheDocument();
    expect(screen.getByText("Current status")).toBeInTheDocument();
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
  });

  it("shows cancelled jobs as a terminal branch without completed as a future step", async () => {
    vi.mocked(getJobDetailRequest).mockResolvedValue({
      ...baseJob,
      status: "CANCELLED",
      scheduledStartAt: "2026-03-20T01:00:00.000Z",
      scheduledEndAt: "2026-03-20T02:00:00.000Z",
      updatedAt: "2026-03-20T01:30:00.000Z",
    });
    vi.mocked(getJobHistoryRequest).mockResolvedValue({
      history: [],
      allowedTransitions: [],
    });

    render(<JobDetailPage />);

    expect(await screen.findByText("Job lifecycle")).toBeInTheDocument();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
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

    expect(await screen.findByText("Job lifecycle")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your current role can review this lifecycle, but manual status edits are reserved for owners and managers.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark scheduled" })).not.toBeInTheDocument();
  });

  it("lets assigned staff submit in-progress work for review", async () => {
    const inProgressJob: JobDetail = {
      ...baseJob,
      status: "IN_PROGRESS",
    };
    vi.mocked(getJobDetailRequest).mockResolvedValue(inProgressJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue({
      history: [],
      allowedTransitions: ["PENDING_REVIEW", "CANCELLED"],
    });
    vi.mocked(submitJobCompletionReviewRequest).mockResolvedValue({
      job: {
        ...inProgressJob,
        status: "PENDING_REVIEW",
      },
      review: {
        id: "review-1",
        jobId: "job-1",
        completionNote: "Leak repaired and tested.",
        status: "PENDING",
        submittedAt: "2026-03-20T02:00:00.000Z",
        submittedBy: {
          id: "staff-1",
          displayName: "Sam Staff",
          email: "sam@acme.example",
        },
        reviewedAt: null,
        reviewNote: null,
        aiStatus: null,
        aiSummary: null,
        aiFindings: null,
      },
      historyEntry: {
        id: "history-review",
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_REVIEW",
        reason: "Completion submitted for review.",
        changedAt: "2026-03-20T02:00:00.000Z",
        changedBy: {
          id: "staff-1",
          displayName: "Sam Staff",
          email: "sam@acme.example",
        },
      },
      allowedTransitions: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
    });
    useAuthStore.setState({
      user: {
        id: "staff-1",
        email: "sam@acme.example",
        displayName: "Sam Staff",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    const user = userEvent.setup();
    render(<JobDetailPage />);

    await user.type(
      await screen.findByPlaceholderText(
        "Summarize the completed work and mention any evidence already uploaded.",
      ),
      "Leak repaired and tested.",
    );
    await user.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => {
      expect(submitJobCompletionReviewRequest).toHaveBeenCalledWith("access-token", "job-1", {
        completionNote: "Leak repaired and tested.",
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText("Completion submitted for review.").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0);
  });

  it("lets owners approve a pending completion review", async () => {
    const pendingJob: JobDetail = {
      ...baseJob,
      status: "PENDING_REVIEW",
    };
    const pendingReview = {
      id: "review-1",
      jobId: "job-1",
      completionNote: "Leak repaired and tested.",
      status: "PENDING" as const,
      submittedAt: "2026-03-20T02:00:00.000Z",
      submittedBy: {
        id: "staff-1",
        displayName: "Sam Staff",
        email: "sam@acme.example",
      },
      reviewedAt: null,
      reviewNote: null,
      aiStatus: null,
      aiSummary: null,
      aiFindings: null,
    };
    vi.mocked(getJobDetailRequest).mockResolvedValue(pendingJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue({
      history: [],
      allowedTransitions: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
    });
    vi.mocked(getLatestJobCompletionReviewRequest).mockResolvedValue(pendingReview);
    vi.mocked(approveJobCompletionReviewRequest).mockResolvedValue({
      job: {
        ...pendingJob,
        status: "COMPLETED",
      },
      review: {
        ...pendingReview,
        status: "APPROVED",
        reviewedAt: "2026-03-20T03:00:00.000Z",
        reviewedBy: {
          id: "user-1",
          displayName: "Owner",
          email: "owner@acme.example",
        },
      },
      historyEntry: {
        id: "history-complete",
        fromStatus: "PENDING_REVIEW",
        toStatus: "COMPLETED",
        reason: "Completion review approved.",
        changedAt: "2026-03-20T03:00:00.000Z",
      },
      allowedTransitions: [],
    });

    const user = userEvent.setup();
    render(<JobDetailPage />);

    expect(await screen.findByText("Waiting for review.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve completion" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve completion" }));

    await waitFor(() => {
      expect(approveJobCompletionReviewRequest).toHaveBeenCalledWith(
        "access-token",
        "job-1",
        "review-1",
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Completion approved.").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("lets owners return a pending completion review for rework", async () => {
    const pendingJob: JobDetail = {
      ...baseJob,
      status: "PENDING_REVIEW",
    };
    const pendingReview = {
      id: "review-1",
      jobId: "job-1",
      completionNote: "Leak repaired and tested.",
      status: "PENDING" as const,
      submittedAt: "2026-03-20T02:00:00.000Z",
      submittedBy: {
        id: "staff-1",
        displayName: "Sam Staff",
        email: "sam@acme.example",
      },
      reviewedAt: null,
      reviewNote: null,
      aiStatus: null,
      aiSummary: null,
      aiFindings: null,
    };
    vi.mocked(getJobDetailRequest).mockResolvedValue(pendingJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue({
      history: [],
      allowedTransitions: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
    });
    vi.mocked(getLatestJobCompletionReviewRequest).mockResolvedValue(pendingReview);
    vi.mocked(returnJobCompletionReviewRequest).mockResolvedValue({
      job: {
        ...pendingJob,
        status: "IN_PROGRESS",
      },
      review: {
        ...pendingReview,
        status: "RETURNED",
        reviewedAt: "2026-03-20T03:00:00.000Z",
        reviewedBy: {
          id: "user-1",
          displayName: "Owner",
          email: "owner@acme.example",
        },
        reviewNote: "Please add clearer evidence.",
      },
      historyEntry: {
        id: "history-return",
        fromStatus: "PENDING_REVIEW",
        toStatus: "IN_PROGRESS",
        reason: "Returned for rework: Please add clearer evidence.",
        changedAt: "2026-03-20T03:00:00.000Z",
      },
      allowedTransitions: ["PENDING_REVIEW", "CANCELLED"],
    });

    const user = userEvent.setup();
    render(<JobDetailPage />);

    expect(await screen.findByText("Waiting for review.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return for rework" }));
    await user.type(
      screen.getByPlaceholderText("Explain what needs to be fixed or added before approval."),
      "Please add clearer evidence.",
    );
    await user.click(screen.getByRole("button", { name: "Confirm return" }));

    await waitFor(() => {
      expect(returnJobCompletionReviewRequest).toHaveBeenCalledWith(
        "access-token",
        "job-1",
        "review-1",
        { reviewNote: "Please add clearer evidence." },
      );
    });

    expect(await screen.findByText("Completion returned for rework.")).toBeInTheDocument();
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
  });

  it("keeps pending review controls hidden for staff", async () => {
    const pendingJob: JobDetail = {
      ...baseJob,
      status: "PENDING_REVIEW",
    };
    vi.mocked(getJobDetailRequest).mockResolvedValue(pendingJob);
    vi.mocked(getJobHistoryRequest).mockResolvedValue({
      history: [],
      allowedTransitions: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
    });
    vi.mocked(getLatestJobCompletionReviewRequest).mockResolvedValue({
      id: "review-1",
      jobId: "job-1",
      completionNote: "Leak repaired and tested.",
      status: "PENDING",
      submittedAt: "2026-03-20T02:00:00.000Z",
      submittedBy: {
        id: "staff-1",
        displayName: "Sam Staff",
        email: "sam@acme.example",
      },
      reviewedAt: null,
      reviewNote: null,
      aiStatus: null,
      aiSummary: null,
      aiFindings: null,
    });
    useAuthStore.setState({
      user: {
        id: "staff-1",
        email: "sam@acme.example",
        displayName: "Sam Staff",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<JobDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Waiting for review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve completion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return for rework" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit status" })).not.toBeInTheDocument();
  });
});
