import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";

describe("InlineErrorBanner", () => {
  it("renders a plain error message", () => {
    render(<InlineErrorBanner message="Failed to load jobs." />);

    expect(screen.getByText("Failed to load jobs.")).toBeInTheDocument();
    expect(screen.queryByText(/Request ID:/i)).not.toBeInTheDocument();
  });

  it("renders request id metadata when available", () => {
    render(
      <InlineErrorBanner
        message={{
          message: "Failed to load jobs.",
          requestId: "request-123",
        }}
      />,
    );

    expect(screen.getByText("Failed to load jobs.")).toBeInTheDocument();
    expect(screen.getByText(/Request ID:/i)).toBeInTheDocument();
    expect(screen.getByText("request-123")).toBeInTheDocument();
  });
});
