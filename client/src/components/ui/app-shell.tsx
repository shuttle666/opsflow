"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Home,
  LogOut,
  Search,
  UserPlus,
  Users,
  type IconComponent,
} from "@/components/ui/icons";
import { useState, useTransition } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  selectClassName,
  subtleButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";

type PublicShellProps = {
  children: React.ReactNode;
  className?: string;
};

type WorkspaceShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

type AppShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: "public" | "workspace";
  actions?: React.ReactNode;
};

const publicNavigation = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: IconComponent;
};

function getWorkspaceNavigation(role: string | undefined) {
  if (role === "STAFF") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/jobs/my", label: "My Jobs", icon: Briefcase },
      { href: "/invitations/accept", label: "Invitations", icon: UserPlus },
    ] satisfies WorkspaceNavItem[];
  }

  return [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/team", label: "Team", icon: UserPlus },
  ] satisfies WorkspaceNavItem[];
}

function isActiveNav(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function initialsFor(name: string | undefined) {
  if (!name) {
    return "OF";
  }

  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function BrandMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-sky-500 to-cyan-500 shadow-[0_14px_28px_-20px_rgba(8,145,178,0.7)]" />
  );
}

function WorkspaceNav({
  items,
  pathname,
}: {
  items: WorkspaceNavItem[];
  pathname: string;
}) {
  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const active = isActiveNav(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-cyan-500/10 text-cyan-600"
                : "text-slate-500 hover:bg-white/40 hover:text-slate-700",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PublicShell({ children, className }: PublicShellProps) {
  const status = useAuthStore((state) => state.status);

  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-app px-4 py-4 sm:px-6", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-white/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1240px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 py-2">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-xl font-bold text-slate-900">OpsFlow</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            {publicNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  subtleButtonClassName,
                  "px-4",
                  item.href === "/" ? "hidden sm:inline-flex" : "inline-flex",
                )}
              >
                {item.label}
              </Link>
            ))}

            {status === "authenticated" ? (
              <Link href="/dashboard" className={secondaryButtonClassName}>
                Open workspace
              </Link>
            ) : null}
          </nav>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  title,
  description,
  children,
  actions,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const availableTenants = useAuthStore((state) => state.availableTenants);
  const switchTenant = useAuthStore((state) => state.switchTenant);
  const logout = useAuthStore((state) => state.logout);

  const navigation = getWorkspaceNavigation(currentTenant?.role);

  const handleSwitchTenant = (tenantId: string) => {
    setActionError(null);
    startTransition(() => {
      void switchTenant(tenantId).catch((error: unknown) => {
        setActionError(
          error instanceof Error ? error.message : "Failed to switch tenant.",
        );
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
    <div className="relative min-h-screen overflow-hidden bg-app px-4 py-4 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18),transparent_68%)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-6rem] top-44 h-56 w-56 rounded-full bg-cyan-100/35 blur-3xl" />

      <div className="relative mx-auto flex max-w-[1440px] gap-6">
        <aside className={`${surfaceClassName} hidden h-[calc(100vh-3rem)] w-[260px] shrink-0 flex-col p-6 xl:flex`}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-xl font-bold text-slate-900">OpsFlow</span>
          </Link>

          <div className="mt-8 flex-1">
            <WorkspaceNav items={navigation} pathname={pathname} />
          </div>

          {availableTenants.length > 0 ? (
            <label className="mt-4 block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Workspace
              </span>
              <select
                value={currentTenant?.tenantId ?? ""}
                onChange={(event) => handleSwitchTenant(event.target.value)}
                disabled={isPending || !currentTenant}
                className={selectClassName}
              >
                {availableTenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName} ({tenant.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}

          {user && currentTenant ? (
            <div className="mt-5 flex items-center gap-3 rounded-full border border-white/50 bg-white/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                {initialsFor(user.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {currentTenant.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-[calc(100vh-3rem)] flex-col gap-6">
            <header className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
                  {description ? (
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="hidden xl:flex items-center gap-3 rounded-[28px] border border-white/70 bg-white px-4 py-2.5 shadow-sm">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-400">Search...</span>
                  </div>
                  {actions}
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/70 bg-white shadow-sm transition hover:bg-slate-50"
                  >
                    <Bell className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className={`${surfaceClassName} p-3 xl:hidden`}>
                <WorkspaceNav items={navigation} pathname={pathname} />

                {currentTenant ? (
                  <div className="mt-4 space-y-3">
                    <select
                      value={currentTenant.tenantId}
                      onChange={(event) => handleSwitchTenant(event.target.value)}
                      disabled={isPending}
                      className={selectClassName}
                    >
                      {availableTenants.map((tenant) => (
                        <option key={tenant.tenantId} value={tenant.tenantId}>
                          {tenant.tenantName} ({tenant.role})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        {user?.displayName ?? "Signed in"} • {currentTenant.role}
                      </p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isPending}
                        className={subtleButtonClassName}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {actionError ? <p className="xl:hidden text-sm text-rose-600">{actionError}</p> : null}
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto pb-2 xl:pr-2">
              <div className="space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  children,
  variant = "workspace",
  actions,
}: AppShellProps) {
  if (variant === "public") {
    return (
      <PublicShell>
        <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-4xl items-center">
          <div className="w-full space-y-6">
            {(title || description) ? (
              <div className={`${surfaceClassName} p-8`}>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
                  {description ? (
                    <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {children}
          </div>
        </section>
      </PublicShell>
    );
  }

  return (
    <WorkspaceShell title={title} description={description} actions={actions}>
      {children}
    </WorkspaceShell>
  );
}

export { primaryButtonClassName, secondaryButtonClassName, subtleButtonClassName };
