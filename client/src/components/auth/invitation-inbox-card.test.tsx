import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationInboxCard } from "@/components/auth/invitation-inbox-card";
import { useAuthStore } from "@/store/auth-store";

describe("InvitationInboxCard", () => {
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
      listMyInvitations: vi.fn().mockResolvedValue([]),
      acceptInvitationById: vi.fn(),
    });
  });

  it("shows empty state when there are no pending invitations", async () => {
    render(<InvitationInboxCard />);
    expect(
      await screen.findByText("No pending invitations right now."),
    ).toBeInTheDocument();
  });

  it("accepts invitation by id and refreshes list", async () => {
    const listMyInvitations = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "invitation-1",
          tenantId: "tenant-2",
          tenantName: "Acme Field Ops",
          role: "STAFF",
          status: "PENDING",
          expiresAt: "2026-03-29T12:00:00.000Z",
          createdAt: "2026-03-20T03:00:00.000Z",
        },
      ])
      .mockResolvedValue([]);
    const acceptInvitationById = vi.fn().mockResolvedValue({
      tenantId: "tenant-2",
      role: "STAFF",
    });
    useAuthStore.setState({
      listMyInvitations,
      acceptInvitationById,
    });

    const user = userEvent.setup();
    render(<InvitationInboxCard />);

    expect(await screen.findByText("Acme Field Ops")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(acceptInvitationById).toHaveBeenCalledWith("invitation-1");
    });
    expect(
      await screen.findByText("No pending invitations right now."),
    ).toBeInTheDocument();
  });
});
