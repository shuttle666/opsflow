import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditCustomerPage from "@/app/customers/[customerId]/edit/page";
import {
  getCustomerDetailRequest,
  updateCustomerRequest,
} from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({
    customerId: "customer-1",
  }),
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
  getCustomerDetailRequest: vi.fn(),
  updateCustomerRequest: vi.fn(),
}));

describe("edit customer page", () => {
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

  it("loads default values and submits updates", async () => {
    vi.mocked(getCustomerDetailRequest).mockResolvedValue({
      id: "customer-1",
      name: "Noah Thompson",
      phone: "0412 000 001",
      email: "noah@example.com",
      address: "12 Glenview Rd",
      notes: null,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      createdBy: {
        id: "user-1",
        displayName: "Owner",
        email: "owner@acme.example",
      },
      jobs: [],
    });
    vi.mocked(updateCustomerRequest).mockResolvedValue({
      id: "customer-1",
      name: "Noah Thompson Updated",
      phone: "0412 000 001",
      email: "noah.updated@example.com",
      address: "14 Glenview Rd",
      notes: null,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T01:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<EditCustomerPage />);

    expect(await screen.findByDisplayValue("Noah Thompson")).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Noah Thompson");
    await user.clear(nameInput);
    await user.type(nameInput, "Noah Thompson Updated");

    const emailInput = screen.getByDisplayValue("noah@example.com");
    await user.clear(emailInput);
    await user.type(emailInput, "noah.updated@example.com");

    const addressInput = screen.getByDisplayValue("12 Glenview Rd");
    await user.clear(addressInput);
    await user.type(addressInput, "14 Glenview Rd");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(vi.mocked(updateCustomerRequest)).toHaveBeenCalledWith(
        "access-token",
        "customer-1",
        expect.objectContaining({
          name: "Noah Thompson Updated",
          email: "noah.updated@example.com",
          address: "14 Glenview Rd",
        }),
      );
      expect(pushMock).toHaveBeenCalledWith("/customers/customer-1");
    });
  });
});
