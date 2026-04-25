import Link from "next/link";
import { PublicShell } from "@/components/ui/app-shell";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
} from "@/components/ui/icons";

const heroVideoUrl = "/opsflow-hero-bg.mp4";

const heroHighlights = [
  "Job scheduling",
  "Crew visibility",
  "AI-assisted planning",
] as const;

const modules = [
  {
    title: "Customer records",
    description: "Contact details, notes, and job history stay linked from the first request.",
    icon: Users,
  },
  {
    title: "Dispatch workflow",
    description: "Create, schedule, assign, review, and complete jobs from one workspace.",
    icon: Briefcase,
  },
  {
    title: "Schedule planning",
    description: "See crew availability and route pressure before the day starts drifting.",
    icon: Calendar,
  },
  {
    title: "Team access",
    description: "Invite members with role-aware visibility for owners, managers, and staff.",
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <PublicShell variant="immersive">
      <div className="space-y-10 pb-10">
        <section className="relative left-1/2 isolate min-h-[calc(100svh-1.5rem)] w-screen -translate-x-1/2 overflow-hidden bg-white">
          <video
            className="landing-video-media absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
          <div className="landing-video-tint" />

          <div className="relative mx-auto flex min-h-[calc(100svh-1.5rem)] max-w-[1240px] flex-col items-center justify-center px-4 pb-24 pt-40 text-center sm:px-6 lg:pb-28 lg:pt-44">
            <div className="max-w-3xl">
              <div className="mx-auto inline-flex w-fit items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-app-panel)_72%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-[0_12px_32px_-24px_rgba(0,0,0,0.38)] backdrop-blur">
                <Sparkles className="h-4 w-4 text-[var(--color-sidebar-accent)]" />
                Field operations command center
              </div>

              <h1 className="landing-video-title mt-5 text-5xl font-extrabold leading-[1.02] text-[var(--color-text)] sm:text-7xl lg:text-8xl">
                OpsFlow
              </h1>
              <p className="landing-video-copy mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
                A focused workspace for service teams to coordinate customers,
                jobs, schedules, team access, and AI-assisted planning without
                losing the day in admin noise.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login?mode=register"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-5 text-[13px] font-semibold text-white shadow-[0_16px_34px_-24px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)]"
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-app-panel)_64%,transparent)] px-5 text-[13px] font-semibold text-[var(--color-text)] backdrop-blur transition hover:bg-[color-mix(in_srgb,var(--color-app-panel)_82%,transparent)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[color-mix(in_srgb,var(--color-app-panel)_54%,transparent)] hover:text-[var(--color-text)]"
                >
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {heroHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--color-app-panel)_54%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] backdrop-blur"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] space-y-10 px-4 sm:px-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <article
                  key={module.title}
                  className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-5 shadow-[var(--shadow-panel)] transition hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-panel-hover)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-base font-bold text-[var(--color-text)]">
                    {module.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {module.description}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-brand)]">
                Start the day aligned
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-[var(--color-text)]">
                Every route leads back to the work that needs attention.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
                Owners can create the workspace, managers can dispatch the day,
                and staff can stay focused on assigned jobs without digging
                through disconnected tools.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Customer timeline ready",
                "Crew workload visible",
                "Planner recommendations",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-panel)]"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
