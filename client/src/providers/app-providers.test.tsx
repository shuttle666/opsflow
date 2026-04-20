import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("AppProviders theme attributes", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-scheme");
    useAuthStore.setState({ bootstrapSession: vi.fn() });
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
});
