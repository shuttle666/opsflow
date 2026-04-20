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
      <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-4 text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-panel)]">
        Loading session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
