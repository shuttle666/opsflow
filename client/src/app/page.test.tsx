import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/components/ui/app-shell", () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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

describe("public home page", () => {
  it("leads with the human approval boundary and recruiter paths", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI prepares the plan. People approve the change.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a quick demo" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getAllByRole("link", { name: "Source" })[0]).toHaveAttribute(
      "href",
      "https://github.com/shuttle666/opsflow",
    );
    expect(
      screen.getByText("Independent full-stack case study · Wenduo Wang"),
    ).toBeInTheDocument();
  });

  it("uses a full-viewport video behind a clearly static interface preview", () => {
    const { container } = render(<HomePage />);

    expect(screen.getByText("Proposal review")).toBeInTheDocument();
    expect(screen.getByText("Static interface preview")).toBeInTheDocument();
    expect(screen.getByText("No business data has changed.")).toBeInTheDocument();
    expect(screen.getByText("Owner / Manager review")).toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm plan")).not.toBeInTheDocument();
    expect(container.querySelector("video")).toHaveClass("landing-hero-video");
    expect(container.querySelector(".landing-hero-media")).toBeInTheDocument();
    expect(container.querySelector("source")).toHaveAttribute(
      "media",
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("presents the safety boundary and role-aware lifecycle as distinct sections", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "A visible boundary between suggestion and execution.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Three roles. One auditable job lifecycle.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Job lifecycle" })).toBeInTheDocument();
  });
});
