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

    await user.click(screen.getByRole("button", { name: "Create account" }));

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

    await user.type(screen.getByPlaceholderText("owner@acme.example"), "owner@acme.example");
    await user.type(screen.getByPlaceholderText("minimum 8 characters"), "owner-password-123");
    await user.type(screen.getByPlaceholderText("Avery Owner"), "Avery Owner");
    await user.type(
      screen.getByPlaceholderText("Acme Home Services"),
      "Acme Home Services",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

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
