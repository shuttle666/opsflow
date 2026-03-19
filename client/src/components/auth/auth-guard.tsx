"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const query = searchParams.toString();

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const nextPath = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [status, pathname, query, router]);

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
