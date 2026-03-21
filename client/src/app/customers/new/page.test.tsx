import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewCustomerPage from "@/app/customers/new/page";
import { createCustomerRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/section-card", () => ({
  SectionCard: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/customer/customer-api", () => ({
  createCustomerRequest: vi.fn(),
}));

describe("new customer page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@acme.example",
        displayName: "Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "OWNER",
      },
      availableTenants: [],
      accessToken: "access-token",
      refreshToken: "refresh-token",
      withAccessTokenRetry: async <T,>(request: (accessToken: string) => Promise<T>) =>
        request("access-token"),
    });
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<NewCustomerPage />);

    await user.click(screen.getByRole("button", { name: "Create customer" }));

    expect(await screen.findByText("Customer name is required")).toBeInTheDocument();
  });

  it("submits and redirects to detail page", async () => {
    vi.mocked(createCustomerRequest).mockResolvedValue({
      id: "customer-1",
      name: "Noah Thompson",
      phone: "0412 000 001",
      email: "noah@example.com",
      address: "12 Glenview Rd",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<NewCustomerPage />);

    await user.type(screen.getByPlaceholderText("Noah Thompson"), "Noah Thompson");
    await user.type(screen.getByPlaceholderText("0412 000 001"), "0412 000 001");
    await user.type(screen.getByPlaceholderText("noah@example.com"), "noah@example.com");
    await user.type(
      screen.getByPlaceholderText("12 Glenview Rd, Adelaide"),
      "12 Glenview Rd",
    );
    await user.click(screen.getByRole("button", { name: "Create customer" }));

    await waitFor(() => {
      expect(vi.mocked(createCustomerRequest)).toHaveBeenCalledWith(
        "access-token",
        {
          name: "Noah Thompson",
          phone: "0412 000 001",
          email: "noah@example.com",
          address: "12 Glenview Rd",
        },
      );
      expect(pushMock).toHaveBeenCalledWith("/customers/customer-1");
    });
  });
});
