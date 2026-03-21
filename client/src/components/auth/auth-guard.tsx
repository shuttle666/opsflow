"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const query = typeof window !== "undefined" ? window.location.search : "";
    const nextPath = query ? `${pathname}${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-app-border bg-app-panel p-6 text-sm text-slate-600">
        Loading session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
