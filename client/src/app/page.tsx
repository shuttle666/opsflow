import Link from "next/link";
import { PublicShell } from "@/components/ui/app-shell";
import { ArrowRight, Briefcase, ShieldCheck, Users } from "@/components/ui/icons";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  strongSurfaceClassName,
} from "@/components/ui/styles";

const frontendModules = [
  "Customer and contact directory",
  "Job scheduling and workflow history",
  "Team access, invitations, and roles",
  "Tenant-aware session and workspace context",
];

export default function HomePage() {
  return (
    <PublicShell>
      <div className="flex min-h-[calc(100vh-7rem)] items-center py-6">
        <div className="grid w-full gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={`${strongSurfaceClassName} p-8 sm:p-10`}>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700">
                  Field operations platform
                </p>
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  Keep customers, jobs, and team activity in one calm workspace.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-500">
                  OpsFlow gives service teams a lightweight control center for
                  daily dispatch, customer records, and member access without
                  burying the product under admin noise.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className={`${primaryButtonClassName} min-w-[11.5rem] px-6 text-base`}
                  style={{ color: "#ffffff" }}
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className={secondaryButtonClassName}>
                  Sign in
                </Link>
                <Link href="/dashboard" className={secondaryButtonClassName}>
                  Open workspace
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-sm">
                  <Users className="h-5 w-5 text-sky-600" />
                  <p className="mt-4 text-sm font-semibold text-slate-900">Customers</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Directory views, detail pages, and quick job handoff.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-sm">
                  <Briefcase className="h-5 w-5 text-cyan-600" />
                  <p className="mt-4 text-sm font-semibold text-slate-900">Jobs</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Work orders, assignment context, and lifecycle tracking.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-sm">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <p className="mt-4 text-sm font-semibold text-slate-900">Team Access</p>
                  <p className="mt-1 text-sm text-slate-500">
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
              <ul className="space-y-3 text-sm text-slate-600">
                {frontendModules.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-500" />
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
                  className="flex items-center justify-between rounded-[24px] border border-white/70 bg-white px-4 py-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Create the first tenant workspace
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-between rounded-[24px] border border-white/70 bg-white px-4 py-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Sign in with an existing account
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </SummaryCard>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
