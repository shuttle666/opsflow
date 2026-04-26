import Link from "next/link";
import { PublicShell } from "@/components/ui/app-shell";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "@/components/ui/icons";

const heroVideoUrl = "/opsflow-hero-bg.mp4";

const heroHighlights = [
  "Job scheduling",
  "Crew visibility",
  "AI-assisted planning",
] as const;

const workflowSteps = [
  {
    step: "01",
    title: "Capture the request",
    detail: "Customer, notes, address, and job history stay together from the first call.",
  },
  {
    step: "02",
    title: "Shape the day",
    detail: "Managers compare availability, workload, and routes before assigning work.",
  },
  {
    step: "03",
    title: "Approve the plan",
    detail: "AI drafts changes, people review them, and staff see what is ready next.",
  },
] as const;

const previewJobs = [
  { title: "Dishwasher leak", customer: "Archie Wright", status: "Ready to assign" },
  { title: "Heat pump service", customer: "Mia Chen", status: "Scheduled" },
  { title: "No hot water", customer: "Harper Lee", status: "Needs review" },
] as const;

const scheduleBars = [
  { name: "Alex", width: "74%", offset: "0%" },
  { name: "Riley", width: "52%", offset: "18%" },
  { name: "Sam", width: "64%", offset: "8%" },
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
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-5 text-[13px] font-semibold !text-white shadow-[0_16px_34px_-24px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)] hover:!text-white"
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

        <div className="mx-auto max-w-[1240px] space-y-12 px-4 sm:px-6">
          <section className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div className="px-1 sm:px-2 lg:px-4">
              <p className="text-xs font-semibold uppercase text-[var(--color-brand)]">
                Operations preview
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight text-[var(--color-text)]">
                See the day before it starts moving.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
                OpsFlow turns customers, jobs, team availability, and AI planning
                into one calm dispatch surface.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Customers", "Jobs", "Schedule", "AI Planner"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-3">
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-panel)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-app-border)] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                      Today
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">
                      Dispatch board
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    <span className="rounded-md bg-[var(--color-app-panel)] px-2.5 py-1 text-[var(--color-brand)]">
                      Live
                    </span>
                    <span className="px-2.5 py-1">Review</span>
                  </div>
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-2">
                    {previewJobs.map((job) => (
                      <div
                        key={job.title}
                        className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {job.title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              {job.customer}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[var(--color-brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand)]">
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        Crew load
                      </p>
                      <span className="text-[11px] font-semibold text-[var(--color-success)]">
                        Balanced
                      </span>
                    </div>
                    <div className="mt-4 space-y-4">
                      {scheduleBars.map((bar) => (
                        <div key={bar.name}>
                          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--color-text-secondary)]">
                            <span>{bar.name}</span>
                            <span>Route window</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-[var(--color-app-panel)]">
                            <div
                              className="h-2.5 rounded-full bg-[var(--color-brand)] shadow-[0_4px_16px_-10px_var(--color-brand-glow)]"
                              style={{
                                marginLeft: bar.offset,
                                width: bar.width,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          AI draft ready
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                        Assign the urgent leak job to the nearest available tech.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {workflowSteps.map((item) => (
              <article
                key={item.step}
                className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-5 shadow-[var(--shadow-panel)]"
              >
                <span className="text-xs font-bold text-[var(--color-brand)]">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold text-[var(--color-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {item.detail}
                </p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 rounded-[18px] border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Built for the morning dispatch rhythm
                </p>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Open the workspace, review what changed, and move the team from
                intake to scheduled work without switching tools.
              </p>
            </div>
            <Link
              href="/login?mode=register"
              className="inline-flex h-10 w-fit items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-5 text-[13px] font-semibold !text-white shadow-[0_16px_34px_-24px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)] hover:!text-white"
            >
              Start planning
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
