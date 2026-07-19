import Link from "next/link";
import { LandingHeroVideo } from "@/components/marketing/landing-hero-video";
import { PublicShell } from "@/components/ui/app-shell";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  FileClock,
  Layers3,
  ShieldCheck,
  Users,
} from "@/components/ui/icons";

const projectSourceUrl = "https://github.com/shuttle666/opsflow";
const architectureUrl = `${projectSourceUrl}/blob/main/docs/engineering/architecture.md`;
const caseStudyUrl = `${projectSourceUrl}/blob/main/docs/engineering/case-study.md`;

const proposalFields = [
  { label: "Customer", value: "Aiden Murphy" },
  { label: "Job", value: "Air conditioner service" },
  { label: "Assignee", value: "Sofia Nguyen · Staff" },
  { label: "Window", value: "Next business day · 14:00–15:00" },
] as const;

const safeFlow = [
  {
    step: "01",
    title: "Proposal",
    detail: "AI persists a reviewable plan.",
    icon: FileClock,
  },
  {
    step: "02",
    title: "Human approval",
    detail: "An Owner or Manager authorizes the targets.",
    icon: ShieldCheck,
    emphasis: true,
  },
  {
    step: "03",
    title: "Revalidate & commit",
    detail: "Current tenant data is checked and claimed once.",
    icon: CheckCircle2,
  },
] as const;

const roles = [
  {
    name: "Owner",
    focus: "Workspace & AI controls",
    detail: "Team access, workspace policy, and proposal approval.",
    icon: Users,
  },
  {
    name: "Manager",
    focus: "Dispatch & review",
    detail: "Scheduling, assignment, and completion review.",
    icon: Calendar,
    emphasis: true,
  },
  {
    name: "Staff",
    focus: "Field work",
    detail: "Assigned jobs, evidence, and completion notes.",
    icon: Briefcase,
  },
] as const;

const jobLifecycle = [
  "NEW",
  "SCHEDULED",
  "IN PROGRESS",
  "PENDING REVIEW",
  "COMPLETED",
] as const;

export default function HomePage() {
  return (
    <PublicShell variant="landing">
      <main className="overflow-x-clip">
        <section className="landing-hero relative isolate overflow-hidden">
          <LandingHeroVideo />
          <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-[1240px] gap-10 px-4 pb-14 pt-32 sm:px-6 sm:pb-16 sm:pt-36 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 lg:pb-20 lg:pt-28">
            <div className="landing-hero-copy max-w-2xl">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Independent full-stack case study · Wenduo Wang
              </p>
              <h1 className="mt-6 text-5xl font-extrabold leading-[1.04] tracking-[-0.045em] text-[var(--color-text)] sm:text-6xl lg:text-[4rem]">
                AI prepares the plan. People approve the change.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
                OpsFlow is a multi-tenant field-operations workspace for intake,
                dispatch, evidence, and review. AI write requests stop at a
                proposal until an authorized user confirms them.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-text)] px-5 text-sm font-semibold !text-[var(--color-app-panel)] transition hover:opacity-85"
                >
                  Start a quick demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#safe-ai"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-app-border-strong)] px-5 text-sm font-semibold transition hover:bg-[var(--color-app-panel-muted)]"
                >
                  See approval flow
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                <Link
                  className="underline-offset-4 hover:underline"
                  href={projectSourceUrl}
                >
                  Source
                </Link>
                <Link
                  className="underline-offset-4 hover:underline"
                  href={architectureUrl}
                >
                  Architecture
                </Link>
                <Link
                  className="underline-offset-4 hover:underline"
                  href={caseStudyUrl}
                >
                  Case study
                </Link>
                <Link
                  className="underline-offset-4 hover:underline"
                  href="https://aboutwenduo.wang"
                >
                  Portfolio
                </Link>
              </div>

              <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                Isolated workspace · Fictional data · Automatic cleanup
              </p>
            </div>

            <div className="relative">
              <div className="landing-hero-label-row mb-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                <span>Proposal review</span>
                <span>Static interface preview</span>
              </div>
              <div className="landing-proposal-card overflow-hidden rounded-xl border border-[var(--color-app-border-strong)] shadow-[0_28px_70px_-44px_rgba(15,23,42,0.48)]">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--color-app-border)] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]" />
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        Schedule service visit
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                        Proposal · Pending
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    #PR-1048
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Create the air conditioner service job, assign Sofia, and
                    schedule the verified demo window.
                  </p>

                  <dl className="mt-6 grid border-y border-[var(--color-app-border)] sm:grid-cols-2">
                    {proposalFields.map((field, index) => (
                      <div
                        key={field.label}
                        className={`py-4 sm:px-4 ${
                          index % 2 === 0
                            ? "sm:border-r sm:border-[var(--color-app-border)] sm:pl-0"
                            : "sm:pr-0"
                        } ${
                          index < 2
                            ? "border-b border-[var(--color-app-border)]"
                            : ""
                        }`}
                      >
                        <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                          {field.label}
                        </dt>
                        <dd className="mt-1.5 text-sm font-semibold text-[var(--color-text)]">
                          {field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-6 border-l-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          No business data has changed.
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                          Permissions, targets, and conflicts will be checked
                          again after approval.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 border-t border-[var(--color-app-border)] pt-5 sm:grid-cols-2 sm:gap-0">
                    <div className="sm:pr-5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                        Current state
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
                        Pending review
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        No mutation applied
                      </p>
                    </div>
                    <div className="sm:border-l sm:border-[var(--color-app-border)] sm:pl-5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                        Next checkpoint
                      </p>
                      <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                        Owner / Manager review
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Revalidate targets → commit once
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="safe-ai" className="safe-ai-section scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 sm:py-24">
            <div className="grid gap-7 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:gap-16">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-sidebar-accent)]">
                  Safe AI writes
                </p>
                <h2 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
                  A visible boundary between suggestion and execution.
                </h2>
              </div>
              <div>
                <p className="text-base leading-7 text-white/65">
                  AI prepares the work. Authorization remains a separate,
                  tenant-scoped decision.
                </p>
                <div className="mt-5 flex items-center gap-3 text-sm font-semibold text-white/85">
                  <Layers3 className="h-5 w-5 text-[var(--color-sidebar-accent)]" />
                  Web Agent + MCP · One Tool Registry
                </div>
              </div>
            </div>

            <ol className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-10">
              {safeFlow.map((item, index) => {
                const Icon = item.icon;

                return (
                  <li
                    key={item.step}
                    className={`safe-ai-stage ${
                      "emphasis" in item && item.emphasis
                        ? "safe-ai-stage-emphasis"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-5">
                      <span className="safe-ai-stage-icon">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="font-mono text-3xl font-medium tracking-[-0.06em] text-white/20">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="mt-8 text-xl font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/62">
                      {item.detail}
                    </p>
                    {index < safeFlow.length - 1 ? (
                      <span className="safe-ai-stage-arrow" aria-hidden="true">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-strong)]">
                Role-aware operations
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-[var(--color-text)] sm:text-5xl">
                Three roles. One auditable job lifecycle.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
              Owners set the boundary, Managers coordinate the work, and Staff
              carry it through with evidence.
            </p>
          </div>

          <div className="role-workflow-panel mt-12 overflow-hidden rounded-[28px] border border-[var(--color-app-border)]">
            <div className="grid lg:grid-cols-3">
              {roles.map((role, index) => {
                const Icon = role.icon;

                return (
                  <article
                    key={role.name}
                    className={`role-column ${
                      "emphasis" in role && role.emphasis
                        ? "role-column-emphasis"
                        : ""
                    } ${index > 0 ? "role-column-divider" : ""}`}
                  >
                    <span className="role-column-icon">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-7 text-2xl font-extrabold tracking-[-0.025em] text-[var(--color-text)]">
                      {role.name}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--color-brand-strong)]">
                      {role.focus}
                    </p>
                    <p className="mt-4 max-w-xs text-sm leading-6 text-[var(--color-text-secondary)]">
                      {role.detail}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-6 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    Job lifecycle
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Each transition is role-checked and recorded.
                  </p>
                </div>
                <FileClock className="h-5 w-5 text-[var(--color-brand)]" />
              </div>

              <div
                className="mt-6 overflow-x-auto pb-1"
                role="region"
                aria-label="Job lifecycle stages"
                tabIndex={0}
              >
                <ol className="job-lifecycle-rail" aria-label="Job lifecycle">
                  {jobLifecycle.map((status) => (
                    <li key={status}>
                      <span className="job-lifecycle-dot" />
                      <span>{status}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto max-w-[1240px] px-4 pb-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-app-border)] py-7">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              OpsFlow · Independent product and engineering case study
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Designed and built by Wenduo Wang
            </p>
          </div>
        </footer>
      </main>
    </PublicShell>
  );
}
