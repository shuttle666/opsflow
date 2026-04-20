import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamPage from "@/app/team/page";
import { listMembershipsRequest, updateMembershipRequest } from "@/features/membership";
import { useAuthStore } from "@/store/auth-store";

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
  SectionCard: ({
    children,
    title,
  }: {
    children?: ReactNode;
    title: string;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@/components/auth/auth-guard", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/auth/invitation-create-card", () => ({
  InvitationCreateCard: () => <div>Invitation management</div>,
}));

vi.mock("@/features/membership", () => ({
  listMembershipsRequest: vi.fn(),
  updateMembershipRequest: vi.fn(),
}));

describe("team page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("loads members and lets owner save membership changes", async () => {
    vi.mocked(listMembershipsRequest).mockResolvedValue({
      items: [
        {
          id: "membership-1",
          userId: "user-2",
          displayName: "Sam Staff",
          email: "sam@acme.example",
          role: "STAFF",
          status: "ACTIVE",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(updateMembershipRequest).mockResolvedValue({
      id: "membership-1",
      userId: "user-2",
      displayName: "Sam Staff",
      email: "sam@acme.example",
      role: "MANAGER",
      status: "ACTIVE",
      createdAt: "2026-03-20T00:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<TeamPage />);

    expect(await screen.findByText("Sam Staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite Member" })).toBeInTheDocument();
    expect(screen.queryByText("Add New Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Role guidance")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invite Member" }));
    expect(screen.getByRole("dialog", { name: "Invite member" })).toBeInTheDocument();
    expect(screen.getByText("Invitation management")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role for sam@acme.example"), "MANAGER");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateMembershipRequest).toHaveBeenCalledWith(
        "access-token",
        "membership-1",
        { role: "MANAGER" },
      );
    });
  });

  it("blocks staff from team page access", () => {
    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "STAFF",
      },
    });

    render(<TeamPage />);

    expect(
      screen.getByText("Your current role cannot access team management in this tenant."),
    ).toBeInTheDocument();
  });
});
