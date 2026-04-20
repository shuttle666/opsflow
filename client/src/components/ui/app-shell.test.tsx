import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicShell } from "@/components/ui/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";

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

describe("theme toggle", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "unauthenticated" });
    useThemeStore.setState({ mode: "light", scheme: "violet" });
  });

  it("renders mode rows and Claude V2 color scheme choices", async () => {
    const user = userEvent.setup();
    render(<PublicShell>Content</PublicShell>);

    await user.click(screen.getByRole("button", { name: "Theme: Light, Electric Violet" }));

    expect(screen.getByRole("menuitemradio", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Electric Violet" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Deep Ocean" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Warm Ember" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: "Deep Ocean" }));

    expect(useThemeStore.getState().scheme).toBe("ocean");
    expect(screen.getByRole("menuitemradio", { name: "Deep Ocean" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(useThemeStore.getState().mode).toBe("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
