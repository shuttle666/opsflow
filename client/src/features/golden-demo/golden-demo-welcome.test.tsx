import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GoldenDemoWelcome } from "./golden-demo-welcome";
import {
  readGoldenDemoProgress,
  writeGoldenDemoProgress,
} from "./golden-demo-storage";

describe("GoldenDemoWelcome", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows once for a newly started private demo and records that it was seen", async () => {
    writeGoldenDemoProgress("started", 0);
    const user = userEvent.setup();

    render(<GoldenDemoWelcome />);

    expect(
      await screen.findByRole("heading", { name: "Your demo workspace is ready" }),
    ).toBeInTheDocument();
    expect(readGoldenDemoProgress()).toMatchObject({
      status: "seen",
      currentStep: 0,
    });

    await user.click(screen.getByRole("button", { name: "View suggested requests" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Your demo workspace is ready" }),
      ).not.toBeInTheDocument();
    });
  });

  it("does not show the welcome again after it has been rendered once", async () => {
    writeGoldenDemoProgress("started", 0);
    const firstRender = render(<GoldenDemoWelcome />);

    expect(
      await screen.findByRole("heading", { name: "Your demo workspace is ready" }),
    ).toBeInTheDocument();
    firstRender.unmount();

    render(<GoldenDemoWelcome />);

    await waitFor(() => {
      expect(readGoldenDemoProgress()?.status).toBe("seen");
    });
    expect(
      screen.queryByRole("heading", { name: "Your demo workspace is ready" }),
    ).not.toBeInTheDocument();
  });

  it("does not interrupt visitors who already handled the welcome", () => {
    writeGoldenDemoProgress("dismissed", 0);

    render(<GoldenDemoWelcome />);

    expect(
      screen.queryByRole("heading", { name: "Your demo workspace is ready" }),
    ).not.toBeInTheDocument();
  });
});
