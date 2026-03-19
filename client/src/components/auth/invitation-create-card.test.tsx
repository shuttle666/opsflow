import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationCreateCard } from "@/components/auth/invitation-create-card";
import { useAuthStore } from "@/store/auth-store";

describe("InvitationCreateCard", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@acme.example",
        displayName: "Avery Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme Home Services",
        tenantSlug: "acme-home-services",
        role: "OWNER",
      },
      availableTenants: [],
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("shows read-only message for STAFF role", () => {
    useAuthStore.setState({
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme Home Services",
        tenantSlug: "acme-home-services",
        role: "STAFF",
      },
    });

    render(<InvitationCreateCard />);

    expect(
      screen.getByText("Only OWNER or MANAGER can invite members in this tenant."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create invitation" }),
    ).not.toBeInTheDocument();
  });

  it("creates invitation and displays token payload", async () => {
    const createInvitation = vi.fn().mockResolvedValue({
      id: "invitation-1",
      tenantId: "tenant-1",
      email: "new.member@example.com",
      role: "STAFF",
      expiresAt: "2026-03-28T12:00:00.000Z",
      token: "invite-token-abc",
    });
    useAuthStore.setState({
      createInvitation,
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme Home Services",
        tenantSlug: "acme-home-services",
        role: "MANAGER",
      },
    });

    const user = userEvent.setup();
    render(<InvitationCreateCard />);

    await user.type(
      screen.getByPlaceholderText("new.member@example.com"),
      "new.member@example.com",
    );
    await user.selectOptions(screen.getByRole("combobox"), "STAFF");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));

    await waitFor(() => {
      expect(createInvitation).toHaveBeenCalledWith({
        email: "new.member@example.com",
        role: "STAFF",
      });
    });

    expect(
      screen.getByText("Invitation created successfully."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Token:/)).toBeInTheDocument();
    expect(screen.getByText(/invite-token-abc/)).toBeInTheDocument();
  });
});
