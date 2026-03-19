"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAuthStore } from "@/store/auth-store";

type AppShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

const publicNavigation = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/dashboard", label: "Dashboard" },
];

const authenticatedNavigation = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invitations/accept", label: "Accept Invitation" },
];

export function AppShell({ title, description, children }: AppShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const availableTenants = useAuthStore((state) => state.availableTenants);
  const switchTenant = useAuthStore((state) => state.switchTenant);
  const logout = useAuthStore((state) => state.logout);

  const navigation =
    status === "authenticated" ? authenticatedNavigation : publicNavigation;

  const handleSwitchTenant = (tenantId: string) => {
    setActionError(null);
    startTransition(() => {
      void switchTenant(tenantId).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Failed to switch tenant.";
        setActionError(message);
      });
    });
  };

  const handleLogout = () => {
    setActionError(null);
    startTransition(() => {
      void logout().finally(() => {
        router.push("/login");
      });
    });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
              OpsFlow
            </p>
            <p className="text-sm text-slate-500">
              Full-stack operations platform starter
            </p>
          </div>

          <nav className="flex items-center gap-2 rounded-full border border-app-border bg-white p-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {status === "authenticated" && user && currentTenant ? (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 pb-4">
            <p className="text-sm text-slate-600">
              Signed in as <span className="font-semibold">{user.displayName}</span>{" "}
              ({user.email})
            </p>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                {currentTenant.role}
              </span>

              <select
                value={currentTenant.tenantId}
                onChange={(event) => handleSwitchTenant(event.target.value)}
                disabled={isPending}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {availableTenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName} ({tenant.role})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Working..." : "Logout"}
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <section className="rounded-[2rem] border border-app-border bg-white/80 p-8 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)]">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Foundation only
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              {description}
            </p>
            {actionError ? (
              <p className="text-sm text-rose-600">{actionError}</p>
            ) : null}
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
