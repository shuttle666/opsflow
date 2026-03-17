import Link from "next/link";
import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";

const frontendModules = [
  "App Router foundation",
  "Tailwind CSS styling",
  "TanStack Query provider",
  "Zustand auth placeholder",
];

export default function HomePage() {
  return (
    <AppShell
      title="OpsFlow engineering foundation"
      description="A clean starter for the operations platform. The client is ready for future auth, customer, job, and staff feature modules."
    >
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <SectionCard
          eyebrow="Overview"
          title="Build the product on stable rails"
          description="This starter intentionally focuses on architecture, shared providers, and placeholder UI instead of business logic."
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open login placeholder
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              View dashboard shell
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Stack"
          title="Frontend building blocks"
          description="Core libraries are installed and wired for future module development."
        >
          <ul className="space-y-3 text-sm text-slate-600">
            {frontendModules.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>
    </AppShell>
  );
}
