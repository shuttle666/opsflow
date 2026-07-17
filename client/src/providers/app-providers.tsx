"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import { QueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";

type AppProvidersProps = {
  children: React.ReactNode;
};

function sameQueryScope(left: QueryScope | null, right: QueryScope | null) {
  return (
    left?.userId === right?.userId &&
    left?.tenantId === right?.tenantId &&
    left?.role === right?.role
  );
}

function AuthQueryCacheBoundary({ children }: AppProvidersProps) {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);
  const tenantId = useAuthStore((state) => state.currentTenant?.tenantId);
  const role = useAuthStore((state) => state.currentTenant?.role);
  const previousScopeRef = useRef<QueryScope | null>(null);

  useEffect(() => {
    const nextScope: QueryScope | null =
      status === "authenticated" && userId && tenantId && role
        ? { userId, tenantId, role }
        : null;
    const previousScope = previousScopeRef.current;

    if (previousScope && !sameQueryScope(previousScope, nextScope)) {
      queryClient.removeQueries({
        queryKey: queryKeys.scope(previousScope),
      });
      queryClient.getMutationCache().clear();
    }

    previousScopeRef.current = nextScope;
  }, [queryClient, role, status, tenantId, userId]);

  return children;
}

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

  return (
    <QueryProvider>
      <AuthQueryCacheBoundary>{children}</AuthQueryCacheBoundary>
    </QueryProvider>
  );
}
