import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuthStore } from "@/store/auth-store";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/dashboard",
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    window.history.replaceState({}, "", "/dashboard?view=compact");
    useAuthStore.setState({
      status: "unauthenticated",
      user: null,
      currentTenant: null,
      availableTenants: [],
      accessToken: null,
      refreshToken: null,
    });
  });

  it("redirects unauthenticated users to login with next path", async () => {
    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%3Fview%3Dcompact",
      );
    });
  });

  it("renders protected content for authenticated users", () => {
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
    });

    const view = render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(view.getByText("Protected content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
