"use client";

import { useEffect } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);
  const mode = useThemeStore((state) => state.mode);
  const scheme = useThemeStore((state) => state.scheme);
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = mode === "system" ? (mediaQuery.matches ? "dark" : "light") : mode;

      root.dataset.theme = resolvedTheme;
      root.dataset.themeMode = mode;
      root.dataset.scheme = scheme;
    };

    applyTheme();

    if (mode !== "system") {
      return;
    }

    mediaQuery.addEventListener("change", applyTheme);
    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [mode, scheme]);

  return <QueryProvider>{children}</QueryProvider>;
}
