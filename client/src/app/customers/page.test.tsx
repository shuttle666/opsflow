import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/customers/page";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";

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

vi.mock("@/components/ui/app-shell", () => ({
  AppShell: ({
    children,
    actions,
  }: {
    children: ReactNode;
    actions?: ReactNode;
  }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/section-card", () => ({
  SectionCard: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/customer/customer-api", () => ({
  listCustomersRequest: vi.fn(),
}));

let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn> | undefined;

function mockCustomerListViewport({
  top,
  innerHeight,
}: {
  top: number;
  innerHeight: number;
}) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });

  getBoundingClientRectSpy?.mockRestore();
  getBoundingClientRectSpy = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue({
      bottom: top,
      height: 0,
      left: 0,
      right: 0,
      top,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
}

describe("customers page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomerListViewport({ top: 300, innerHeight: 900 });
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

  afterEach(() => {
    getBoundingClientRectSpy?.mockRestore();
    getBoundingClientRectSpy = undefined;
  });

  it("loads and renders customers table", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [
        {
          id: "customer-1",
          name: "Noah Thompson",
          phone: "0412 000 001",
          email: "noah@example.com",
          address: "12 Glenview Rd",
          notes: null,
          archivedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
        {
          id: "customer-2",
          name: "Riley Missing",
          phone: null,
          email: null,
          address: null,
          notes: null,
          archivedAt: null,
          createdAt: "2026-03-21T00:00:00.000Z",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
    });

    const user = userEvent.setup();
    render(<CustomersPage />);

    expect(await screen.findByText("Noah Thompson")).toBeInTheDocument();
    expect(screen.getByText("Riley Missing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Customer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sort customers")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer status")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Contact filter"), "missing_contact");

    expect(screen.queryByText("Noah Thompson")).not.toBeInTheDocument();
    expect(screen.getByText("Riley Missing")).toBeInTheDocument();
  });

  it("applies search and hides create button for staff", async () => {
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      },
    });

    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    const user = userEvent.setup();
    render(<CustomersPage />);

    expect(await screen.findByText("No customers found")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Search customers..."),
      "Noah",
    );
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(vi.mocked(listCustomersRequest)).toHaveBeenLastCalledWith(
        "access-token",
        expect.objectContaining({
          q: "Noah",
          status: "active",
        }),
      );
    });

    const lastCall = vi.mocked(listCustomersRequest).mock.calls.at(-1);
    expect(lastCall?.[1].pageSize).toBeGreaterThanOrEqual(10);
    expect(lastCall?.[1].pageSize).toBeLessThanOrEqual(50);

    expect(screen.queryByText("Add Customer")).not.toBeInTheDocument();
  });

  it("requests more customers when the viewport can fit more rows", async () => {
    mockCustomerListViewport({ top: 180, innerHeight: 1500 });
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 21,
        total: 0,
        totalPages: 1,
      },
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(vi.mocked(listCustomersRequest)).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          pageSize: 21,
        }),
      );
    });
  });

  it("keeps at least ten customers per page on short viewports", async () => {
    mockCustomerListViewport({ top: 780, innerHeight: 800 });
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      },
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(vi.mocked(listCustomersRequest)).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          pageSize: 10,
        }),
      );
    });
  });

  it("reserves table header space when calculating customer rows", async () => {
    mockCustomerListViewport({ top: 180, innerHeight: 1005 });
    vi.mocked(listCustomersRequest).mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 12,
        total: 0,
        totalPages: 1,
      },
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(vi.mocked(listCustomersRequest)).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({
          pageSize: 12,
        }),
      );
    });
  });

  it("loads archived customers through the status filter", async () => {
    vi.mocked(listCustomersRequest)
      .mockResolvedValueOnce({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "customer-archived",
            name: "Archived Customer",
            phone: null,
            email: "archived@example.com",
            address: null,
            notes: null,
            archivedAt: "2026-04-01T00:00:00.000Z",
            createdAt: "2026-03-21T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      });

    const user = userEvent.setup();
    render(<CustomersPage />);

    expect(await screen.findByText("No customers found")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Customer status"), "archived");

    await waitFor(() => {
      expect(vi.mocked(listCustomersRequest)).toHaveBeenLastCalledWith(
        "access-token",
        expect.objectContaining({
          status: "archived",
        }),
      );
    });
    expect(await screen.findByText("Archived Customer")).toBeInTheDocument();
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(1);
  });
});
