import { AppShell } from "@/components/ui/app-shell";
import { SectionCard } from "@/components/ui/section-card";

const dashboardCards = [
  {
    title: "Customer operations",
    description: "Reserved for customer lists, details, and lifecycle workflows.",
  },
  {
    title: "Job coordination",
    description: "Ready for scheduling, status tracking, and dispatch surfaces.",
  },
  {
    title: "Team activity",
    description: "Intended for staff visibility, task ownership, and audit trails.",
  },
];

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard placeholder"
      description="A minimal operational shell that future product modules can grow into."
    >
      <section className="grid gap-4 md:grid-cols-3">
        {dashboardCards.map((card) => (
          <SectionCard
            key={card.title}
            eyebrow="Future module"
            title={card.title}
            description={card.description}
          />
        ))}
      </section>
    </AppShell>
  );
}
