import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
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

describe("login page", () => {
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
      login: vi.fn(),
    });
  });

  it("renders the tabbed auth card and fills credentials from demo accounts", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Login" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Register" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByPlaceholderText("Work email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("Demo accounts")).toBeInTheDocument();

    await user.click(screen.getByText("Demo accounts"));
    expect(screen.getByRole("button", { name: /Owner/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manager/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Owner/ }));

    expect(screen.getByLabelText("Email")).toHaveValue("owner@acme.example");
    expect(screen.getByLabelText("Password")).toHaveValue("owner-password-123");
  });

  it("switches to registration without leaving the auth page", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("tab", { name: "Register" }));

    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeInTheDocument();
  });

  it("submits credentials entered by the user and redirects to dashboard", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ login });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "owner@acme.example");
    await user.type(screen.getByLabelText("Password"), "owner-password-123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "owner@acme.example",
        password: "owner-password-123",
      });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
