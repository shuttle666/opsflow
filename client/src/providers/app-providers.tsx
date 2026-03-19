"use client";

import { useEffect } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/store/auth-store";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  return <QueryProvider>{children}</QueryProvider>;
}
