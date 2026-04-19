import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetailPage from "@/app/customers/[customerId]/page";
import {
  getCustomerDetailRequest,
  updateCustomerRequest,
} from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail } from "@/types/customer";

const baseCustomer: CustomerDetail = {
  id: "customer-1",
  name: "Noah Thompson",
  phone: "0412 000 001",
  email: "noah@example.com",
  address: "12 Glenview Rd",
  notes: "Prefers morning appointments.",
  createdAt: "2026-03-20T00:00:00.000Z",
  updatedAt: "2026-03-21T00:00:00.000Z",
  createdBy: {
    id: "user-1",
    displayName: "Owner",
    email: "owner@acme.example",
  },
  jobs: [
    {
      id: "job-1",
      title: "AC Repair",
      status: "SCHEDULED",
      scheduledStartAt: "2026-03-22T00:00:00.000Z",
      scheduledEndAt: "2026-03-22T01:00:00.000Z",
      assignedToName: "Sam Staff",
    },
    {
      id: "job-2",
      title: "Furnace Tune-Up",
      status: "COMPLETED",
      scheduledStartAt: null,
      scheduledEndAt: null,
      assignedToName: undefined,
    },
  ],
};

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

vi.mock("next/navigation", () => ({
  useParams: () => ({
    customerId: "customer-1",
  }),
}));

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/customer/customer-api", () => ({
  getCustomerDetailRequest: vi.fn(),
  updateCustomerRequest: vi.fn(),
}));

describe("customer detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCustomerDetailRequest).mockResolvedValue(baseCustomer);
    vi.mocked(updateCustomerRequest).mockResolvedValue(baseCustomer);
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

  it("loads V2 customer detail with contact, stats, and job history", async () => {
    render(<CustomerDetailPage />);

    expect(await screen.findAllByText("Noah Thompson")).toHaveLength(1);
    expect(screen.getByText("Total jobs")).toBeInTheDocument();
    expect(screen.getByText("Open jobs")).toBeInTheDocument();
    expect(screen.getByText("Contact information")).toBeInTheDocument();
    expect(screen.getByText("AC Repair")).toBeInTheDocument();
    expect(screen.getByText("Furnace Tune-Up")).toBeInTheDocument();
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Create job" })).toHaveAttribute(
      "href",
      "/jobs/new?customerId=customer-1",
    );
    expect(screen.getByRole("link", { name: "Edit customer" })).toHaveAttribute(
      "href",
      "/customers/customer-1/edit",
    );
  });

  it("saves internal notes without losing existing customer fields", async () => {
    const user = userEvent.setup();
    render(<CustomerDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Edit notes" }));
    const notes = screen.getByPlaceholderText("Add internal notes about this customer...");
    await user.clear(notes);
    await user.type(notes, "Gate code changed to 4521.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateCustomerRequest).toHaveBeenCalledWith("access-token", "customer-1", {
        name: "Noah Thompson",
        phone: "0412 000 001",
        email: "noah@example.com",
        address: "12 Glenview Rd",
        notes: "Gate code changed to 4521.",
      });
    });

    expect(await screen.findByText("Gate code changed to 4521.")).toBeInTheDocument();
  });

  it("keeps customer actions and notes editing hidden for staff", async () => {
    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<CustomerDetailPage />);

    expect(await screen.findByText("Customer #customer-1")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create job" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit customer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit notes" })).not.toBeInTheDocument();
  });
});
