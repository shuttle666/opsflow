import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { ApiClientError } from "@/lib/api-client";
import {
  GOLDEN_DEMO_STORAGE_KEY,
  readGoldenDemoProgress,
} from "@/features/golden-demo";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParamsMock = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  useSearchParams: () => searchParamsMock,
}));

describe("login page", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    searchParamsMock = new URLSearchParams();
    useAuthStore.setState({
      status: "unauthenticated",
      user: null,
      currentTenant: null,
      availableTenants: [],
      demoWorkspace: null,
      accessToken: null,
      refreshToken: null,
      login: vi.fn(),
      startPrivateDemo: vi.fn(),
    });
    window.localStorage.clear();
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
    const quickDemoButton = screen.getByRole("button", { name: "Start a quick demo" });
    const sharedDemoSummary = screen.getByText("Shared demo accounts").closest("summary");
    expect(quickDemoButton).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Try a quick demo" })).toBeInTheDocument();
    expect(sharedDemoSummary).toHaveClass(
      "bg-[var(--color-brand)]",
      "rounded-[16px]",
      "text-white",
    );
    expect(quickDemoButton).toHaveClass(
      "bg-[var(--color-brand)]",
      "rounded-[16px]",
      "text-white",
    );

    await user.click(screen.getByText("Shared demo accounts"));
    expect(screen.getByRole("button", { name: /Owner/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manager/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Owner/ }));

    expect(screen.getByLabelText("Email")).toHaveValue("owner@acme.example");
    expect(screen.getByLabelText("Password")).toHaveValue("owner-password-123");
  });

  it("creates a private demo, records local UI progress, and opens the AI Planner", async () => {
    const startPrivateDemo = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ startPrivateDemo });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Start a quick demo" }));

    await waitFor(() => {
      expect(startPrivateDemo).toHaveBeenCalledOnce();
      expect(pushMock).toHaveBeenCalledWith("/agent");
    });
    expect(readGoldenDemoProgress()).toMatchObject({
      version: 1,
      status: "started",
      currentStep: 0,
    });
    expect(window.localStorage.getItem(GOLDEN_DEMO_STORAGE_KEY)).not.toBeNull();
  });

  it("does not let the authenticated redirect override a private demo destination", async () => {
    const startPrivateDemo = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ status: "authenticated" });
    });
    useAuthStore.setState({ startPrivateDemo });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Start a quick demo" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/agent");
    });
    expect(replaceMock).not.toHaveBeenCalledWith("/dashboard");
  });

  it("keeps the visitor on the login page when private demo creation fails", async () => {
    const startPrivateDemo = vi
      .fn()
      .mockRejectedValue(new ApiClientError(429, "Too many demo workspaces."));
    useAuthStore.setState({ startPrivateDemo });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Start a quick demo" }));

    expect(await screen.findByText("Too many demo workspaces.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(readGoldenDemoProgress()).toBeNull();
  });

  it("switches to registration without leaving the auth page", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("tab", { name: "Register" }));

    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeInTheDocument();
  });

  it("prefills the Owner demo without signing in automatically", () => {
    searchParamsMock = new URLSearchParams("demo=owner");
    const login = vi.fn();
    useAuthStore.setState({ login });

    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toHaveValue("owner@acme.example");
    expect(screen.getByLabelText("Password")).toHaveValue("owner-password-123");
    expect(login).not.toHaveBeenCalled();
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

  it("shows request id metadata when login fails", async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiClientError(
        401,
        "Invalid email or password.",
        undefined,
        "login-request-1",
      ),
    );
    useAuthStore.setState({ login });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "owner@acme.example");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByText(/Request ID:/i)).toBeInTheDocument();
    expect(screen.getByText("login-request-1")).toBeInTheDocument();
  });
});
