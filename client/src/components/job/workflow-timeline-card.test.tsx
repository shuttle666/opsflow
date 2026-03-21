import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowTimelineCard } from "@/components/job/workflow-timeline-card";

describe("WorkflowTimelineCard", () => {
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
        currentStatusLabel="New"
        onTransition={onTransition}
      />,
    );

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
});
