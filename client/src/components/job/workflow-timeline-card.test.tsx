import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowTimelineCard } from "@/components/job/workflow-timeline-card";

describe("WorkflowTimelineCard", () => {
  it("renders lifecycle status icons in timeline markers", () => {
    const { container } = render(
      <WorkflowTimelineCard
        items={[
          {
            id: "NEW",
            label: "New",
            status: "NEW",
            timestamp: "2026-03-20 10:00",
            state: "completed",
          },
          {
            id: "SCHEDULED",
            label: "Scheduled",
            status: "SCHEDULED",
            timestamp: "2026-03-20 11:00",
            state: "completed",
          },
          {
            id: "IN_PROGRESS",
            label: "In progress",
            status: "IN_PROGRESS",
            timestamp: "2026-03-20 12:00",
            state: "completed",
          },
          {
            id: "PENDING_REVIEW",
            label: "Pending review",
            status: "PENDING_REVIEW",
            timestamp: "2026-03-20 13:00",
            state: "current",
          },
          {
            id: "COMPLETED",
            label: "Completed",
            status: "COMPLETED",
            timestamp: null,
            state: "upcoming",
          },
          {
            id: "CANCELLED",
            label: "Cancelled",
            status: "CANCELLED",
            timestamp: null,
            state: "upcoming",
          },
        ]}
        actions={[]}
        currentStatus="PENDING_REVIEW"
        currentStatusLabel="Pending review"
      />,
    );

    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(6);
  });

  it("requires a cancellation reason before submitting the transition", async () => {
    const onTransition = vi.fn();
    const user = userEvent.setup();

    render(
      <WorkflowTimelineCard
        items={[
          {
            id: "NEW",
            label: "New",
            status: "NEW",
            timestamp: "2026-03-20 10:00",
            description: "Job created by Owner.",
            state: "current",
          },
        ]}
        actions={[
          {
            id: "cancel",
            label: "Cancel job",
            toStatus: "CANCELLED",
            requiresReason: true,
          },
        ]}
        currentStatus="NEW"
        currentStatusLabel="New"
        currentRole="OWNER"
        canEditJob
        canTransition
        canShowManualControls
        onTransition={onTransition}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit status" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel job" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit status" }));
    await user.click(screen.getByRole("button", { name: "Cancel job" }));

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Cancel job",
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("Explain why this job is being cancelled"),
      "Customer cancelled the visit.",
    );
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "CANCELLED",
      }),
      "Customer cancelled the visit.",
    );
  });

  it("renders field workflow actions for assigned staff", () => {
    const onTransition = vi.fn();

    render(
      <WorkflowTimelineCard
        items={[
          {
            id: "SCHEDULED",
            label: "Scheduled",
            status: "SCHEDULED",
            timestamp: "2026-03-20 11:00",
            state: "current",
          },
        ]}
        actions={[
          {
            id: "start",
            label: "Start work",
            toStatus: "IN_PROGRESS",
          },
        ]}
        currentStatus="SCHEDULED"
        currentStatusLabel="Scheduled"
        currentRole="STAFF"
        isAssignedToCurrentUser
        canTransition
        canShowManualControls
        onTransition={onTransition}
      />,
    );

    expect(screen.getByText("Field workflow")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit status" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start work" })).toBeInTheDocument();
    expect(screen.getByText("Job lifecycle")).toBeInTheDocument();
  });
});
