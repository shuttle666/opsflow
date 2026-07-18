import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import { AppProviders } from "@/providers/app-providers";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";

vi.mock("@/providers/query-provider", () => ({
  QueryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ScopedLocalState() {
  const [value, setValue] = useState("");

  return (
    <input
      aria-label="Scoped draft"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("AppProviders theme attributes", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    window.localStorage.setItem(
      "opsflow-theme",
      JSON.stringify({ mode: "light", scheme: "violet", version: 2 }),
    );
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-scheme");
    useAuthStore.setState({
      status: "unauthenticated",
      user: null,
      currentTenant: null,
      availableTenants: [],
      accessToken: null,
      refreshToken: null,
      bootstrapSession: vi.fn(),
    });
    useThemeStore.setState({ mode: "light", scheme: "violet" });
  });

  it("writes resolved theme mode and scheme to the document root", async () => {
    render(<AppProviders>Content</AppProviders>);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(document.documentElement.dataset.themeMode).toBe("light");
      expect(document.documentElement.dataset.scheme).toBe("violet");
    });

    useThemeStore.getState().setMode("dark");
    useThemeStore.getState().setScheme("ember");

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.themeMode).toBe("dark");
      expect(document.documentElement.dataset.scheme).toBe("ember");
    });
  });

  it("removes only the previous auth scope and clears mutation payloads", async () => {
    const ownerScope: QueryScope = {
      userId: "user-1",
      tenantId: "tenant-1",
      role: "OWNER",
    };
    const tenantScope: QueryScope = {
      userId: "user-1",
      tenantId: "tenant-2",
      role: "OWNER",
    };
    const roleScope: QueryScope = {
      userId: "user-1",
      tenantId: "tenant-2",
      role: "MANAGER",
    };
    const userScope: QueryScope = {
      userId: "user-2",
      tenantId: "tenant-2",
      role: "MANAGER",
    };

    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@example.com",
        displayName: "Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Tenant One",
        tenantSlug: "tenant-one",
        role: "OWNER",
      },
    });

    const { queryClient } = render(<AppProviders>Content</AppProviders>);

    queryClient.setQueryData(queryKeys.dashboard.all(ownerScope), "owner");
    queryClient.setQueryData(queryKeys.dashboard.all(tenantScope), "tenant");
    queryClient.setQueryData(queryKeys.dashboard.all(roleScope), "role");
    queryClient.setQueryData(queryKeys.dashboard.all(userScope), "user");
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: async (value: { secret: string }) => value,
      })
      .execute({ secret: "previous-scope-payload" });

    act(() => {
      useAuthStore.setState({
        currentTenant: {
          tenantId: "tenant-2",
          tenantName: "Tenant Two",
          tenantSlug: "tenant-two",
          role: "OWNER",
        },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.dashboard.all(ownerScope))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.dashboard.all(tenantScope))).toBe("tenant");
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });

    act(() => {
      useAuthStore.setState({
        currentTenant: {
          tenantId: "tenant-2",
          tenantName: "Tenant Two",
          tenantSlug: "tenant-two",
          role: "MANAGER",
        },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.dashboard.all(tenantScope))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.dashboard.all(roleScope))).toBe("role");
    });

    act(() => {
      useAuthStore.setState({
        user: {
          id: "user-2",
          email: "manager@example.com",
          displayName: "Manager",
        },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.dashboard.all(roleScope))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.dashboard.all(userScope))).toBe("user");
    });
  });

  it("remounts local UI state when the authenticated workspace changes", () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@example.com",
        displayName: "Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Tenant One",
        tenantSlug: "tenant-one",
        role: "OWNER",
      },
    });

    render(
      <AppProviders>
        <ScopedLocalState />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("Scoped draft"), {
      target: { value: "tenant-one customer" },
    });
    expect(screen.getByLabelText("Scoped draft")).toHaveValue(
      "tenant-one customer",
    );

    act(() => {
      useAuthStore.setState({
        currentTenant: {
          tenantId: "tenant-2",
          tenantName: "Tenant Two",
          tenantSlug: "tenant-two",
          role: "OWNER",
        },
      });
    });

    expect(screen.getByLabelText("Scoped draft")).toHaveValue("");
  });
});
