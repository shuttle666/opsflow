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

  it("renders the centered auth card and fills credentials from test accounts", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByPlaceholderText("name@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("Test accounts")).toBeInTheDocument();
    expect(screen.getByText("Test accounts").closest("details")).toHaveAttribute("open");

    expect(screen.getByText("owner@acme.example")).toBeInTheDocument();
    expect(screen.getByText("owner-password-123")).toBeInTheDocument();
    expect(screen.getByText("manager@acme.example")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Fill in" })[0]);

    expect(screen.getByLabelText("Email")).toHaveValue("owner@acme.example");
    expect(screen.getByLabelText("Password")).toHaveValue("owner-password-123");
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
