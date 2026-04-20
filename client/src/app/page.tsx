import Link from "next/link";
import { PublicShell } from "@/components/ui/app-shell";
import { ArrowRight, Briefcase, ShieldCheck, Users } from "@/components/ui/icons";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  cn,
  strongSurfaceClassName,
  surfaceClassName,
} from "@/components/ui/styles";

const frontendModules = [
  "Customer and contact directory",
  "Job scheduling and workflow history",
  "Team access, invitations, and roles",
  "Tenant-aware session and workspace context",
];

const neutralPrimaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-text)] bg-[var(--color-text)] px-3.5 text-[13px] font-semibold !text-[var(--color-app-panel)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const neutralSecondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border-strong)] bg-[var(--color-app-panel)] px-3.5 text-[13px] font-semibold text-[var(--color-text)] shadow-sm transition hover:bg-[var(--color-app-panel-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const heroModuleCardClassName =
  "rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-5";

export default function HomePage() {
  return (
    <PublicShell>
      <div className="flex min-h-[calc(100vh-7rem)] items-center py-6">
        <div className="grid w-full gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={`${strongSurfaceClassName} overflow-hidden p-8 sm:p-10`}>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  Field operations platform
                </p>
                <h1 className="max-w-3xl text-4xl font-extrabold text-[var(--color-text)] sm:text-5xl">
                  Keep customers, jobs, and team activity in one calm workspace.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-[var(--color-text-secondary)]">
                  OpsFlow gives service teams a lightweight control center for
                  daily dispatch, customer records, and member access without
                  burying the product under admin noise.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className={cn(neutralPrimaryButtonClassName, "min-w-[11.5rem] px-6")}
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className={neutralSecondaryButtonClassName}
                >
                  Sign in
                </Link>
                <Link
                  href="/dashboard"
                  className={neutralSecondaryButtonClassName}
                >
                  Open workspace
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className={heroModuleCardClassName}>
                  <Users className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">Customers</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Directory views, detail pages, and quick job handoff.
                  </p>
                </div>
                <div className={heroModuleCardClassName}>
                  <Briefcase className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">Jobs</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Work orders, assignment context, and lifecycle tracking.
                  </p>
                </div>
                <div className={heroModuleCardClassName}>
                  <ShieldCheck className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">Team Access</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Roles, invitations, and tenant-aware visibility controls.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <SummaryCard
              eyebrow="Workspace modules"
              title="Everything follows one visual system"
              description="The product UI now shares the same card language, spacing, and palette across each workspace surface."
            >
              <ul className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                {frontendModules.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-text)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SummaryCard>

            <SummaryCard
              eyebrow="Start here"
              title="Choose your next step"
              description="Use the public routes for authentication, then move into the workspace shell."
            >
              <div className="space-y-3">
                <Link
                  href="/register"
                  className={cn(surfaceClassName, "flex items-center justify-between px-4 py-3 text-sm font-semibold transition hover:border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-panel-muted)]")}
                >
                  Create the first tenant workspace
                  <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                </Link>
                <Link
                  href="/login"
                  className={cn(surfaceClassName, "flex items-center justify-between px-4 py-3 text-sm font-semibold transition hover:border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-panel-muted)]")}
                >
                  Sign in with an existing account
                  <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                </Link>
              </div>
            </SummaryCard>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
