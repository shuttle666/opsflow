"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { NotificationBell } from "@/components/notification/notification-bell";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore, type ThemeMode } from "@/store/theme-store";
import { BrandMark } from "@/components/ui/brand-mark";
import {
  Briefcase,
  Calendar,
  Home,
  LogOut,
  Search,
  Sparkles,
  UserPlus,
  Users,
  type IconComponent,
} from "@/components/ui/icons";
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
      { href: "/schedule", label: "My Schedule", icon: Calendar },
      { href: "/jobs/my", label: "My Jobs", icon: Briefcase },
      { href: "/invitations/accept", label: "Invitations", icon: UserPlus },
    ] satisfies WorkspaceNavItem[];
  }

  return [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/schedule", label: "Schedule", icon: Calendar },
    { href: "/team", label: "Team", icon: UserPlus },
    { href: "/agent", label: "AI Planner", icon: Sparkles },
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

function SidebarNav({
  items,
  pathname,
  compact = false,
}: {
  items: WorkspaceNavItem[];
  pathname: string;
  compact?: boolean;
}) {
  return (
    <nav className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      {items.map((item) => {
        const active = isActiveNav(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            style={
              compact
                ? undefined
                : {
                    color: active
                      ? "rgba(255, 255, 255, 0.95)"
                      : "rgba(255, 255, 255, 0.66)",
                  }
            }
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              compact
                ? active
                  ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]"
                : active
                  ? "bg-white/10 text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
            )}
          >
            {!compact && active ? (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-sky-400" />
            ) : null}
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = themeModeLabel(mode);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(subtleButtonClassName, "h-9 px-3 text-xs")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Theme mode: ${label}`}
        title={`Theme: ${label}`}
      >
        <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
        {label}
        <span className="text-[10px] text-[var(--color-text-muted)]">▾</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-1 shadow-[var(--shadow-floating)]"
        >
          {(["system", "light", "dark"] as ThemeMode[]).map((option) => {
            const active = option === mode;

            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setMode(option);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition",
                  active
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]",
                )}
              >
                <span>{themeModeLabel(option)}</span>
                {active ? <span className="text-xs">Active</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function themeModeLabel(mode: ThemeMode) {
  switch (mode) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default:
      return "System";
  }
}

export function PublicShell({ children, className }: PublicShellProps) {
  const status = useAuthStore((state) => state.status);

  return (
    <div className={cn("min-h-screen bg-[var(--color-app)] px-4 py-4 sm:px-6", className)}>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1240px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-app-border)] py-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-xl font-bold text-[var(--color-text)]">OpsFlow</span>
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

            <ThemeToggle />

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
    <div className="min-h-screen bg-[var(--color-app)] text-[var(--color-text)]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[230px] flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#020617_0%,#030712_100%)] text-white shadow-[var(--shadow-panel)] xl:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-3 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-sm font-extrabold text-white shadow-[0_10px_24px_-16px_var(--color-brand-glow)]">
            O
          </span>
          <span className="text-lg font-extrabold text-white">OpsFlow</span>
        </Link>

        <div className="flex-1 px-3 py-3">
          <SidebarNav items={navigation} pathname={pathname} />
        </div>

        <div className="space-y-4 border-t border-white/10 p-4">
          {availableTenants.length > 0 ? (
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase text-white/45">
                Workspace
              </span>
              <select
                value={currentTenant?.tenantId ?? ""}
                onChange={(event) => handleSwitchTenant(event.target.value)}
                disabled={isPending || !currentTenant}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-medium text-white outline-none transition focus:border-sky-300"
              >
                {availableTenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName} ({tenant.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {actionError ? <p className="text-xs text-[var(--color-danger)]">{actionError}</p> : null}

          {user && currentTenant ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/85">
                {initialsFor(user.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white/90">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] font-medium text-white/45">
                  {currentTenant.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="min-h-screen xl:ml-[230px]">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--color-app-border)] bg-[var(--color-app)]/95 px-4 py-3 sm:px-6 xl:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3 xl:hidden">
                  <BrandMark className="h-8 w-8" />
                  <span className="text-lg font-bold text-[var(--color-text)]">OpsFlow</span>
                </div>
                <h1 className="mt-3 text-2xl font-extrabold text-[var(--color-text)] xl:mt-0">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden h-9 items-center gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-sm text-[var(--color-text-muted)] shadow-sm lg:flex">
                  <Search className="h-4 w-4" />
                  <span>Search...</span>
                </div>
                {actions}
                <ThemeToggle />
                <NotificationBell />
              </div>
            </div>

            <div className="mt-4 xl:hidden">
              <div className={cn(surfaceClassName, "p-3")}>
                <SidebarNav compact items={navigation} pathname={pathname} />

                {currentTenant ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                ) : null}
              </div>

              {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 xl:px-7">
            <div className="mx-auto max-w-[1220px] space-y-5">{children}</div>
          </main>
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
          <div className="w-full space-y-5">
            {title || description ? (
              <div className={`${surfaceClassName} p-6`}>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-[var(--color-text)]">{title}</h1>
                  {description ? (
                    <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                      {description}
                    </p>
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
