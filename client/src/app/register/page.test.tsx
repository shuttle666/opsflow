import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PublicShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ThemeToggle: () => <button type="button" aria-label="Theme: Light, Electric Violet" />,
  primaryButtonClassName: "primary-button",
}));

vi.mock("@/components/ui/section-card", () => ({
  SectionCard: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

describe("register page", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    useAuthStore.setState({
      status: "unauthenticated",
      user: null,
      currentTenant: null,
      availableTenants: [],
      accessToken: null,
      refreshToken: null,
      register: vi.fn(),
    });
  });

  it("shows validation messages when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    expect(screen.getByRole("tab", { name: "Register" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(
      await screen.findByText("Password must be at least 8 characters long"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Display name is required")).toBeInTheDocument();
  });

  it("submits registration and redirects to dashboard", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ register });

    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Work email"), "owner@acme.example");
    await user.type(screen.getByPlaceholderText("Password"), "owner-password-123");
    await user.type(screen.getByPlaceholderText("Full name"), "Avery Owner");
    await user.type(
      screen.getByPlaceholderText("Workspace name"),
      "Acme Home Services",
    );
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: "owner@acme.example",
        password: "owner-password-123",
        displayName: "Avery Owner",
        tenantName: "Acme Home Services",
      });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
