import { cn, surfaceClassName } from "@/components/ui/styles";

type InfoCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

type StatCardProps = {
  label: string;
  value: string;
  meta?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "indigo" | "neutral";
};

function statToneClassName(tone: NonNullable<StatCardProps["tone"]>) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-600";
    case "warning":
      return "bg-amber-50 text-amber-600";
    case "indigo":
      return "bg-indigo-50 text-indigo-600";
    case "neutral":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-sky-50 text-sky-600";
  }
}

function BaseInfoCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: InfoCardProps) {
  return (
    <section className={cn(surfaceClassName, "p-5", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function SummaryCard(props: InfoCardProps) {
  return <BaseInfoCard {...props} className={cn("p-6", props.className)} />;
}

export function MetaCard(props: InfoCardProps) {
  return <BaseInfoCard {...props} />;
}

export function ActionCard(props: InfoCardProps) {
  return <BaseInfoCard {...props} />;
}

export function StatCard({
  label,
  value,
  meta,
  icon,
  tone = "brand",
}: StatCardProps) {
  return (
    <div className={`${surfaceClassName} flex flex-col gap-4 p-5`}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            statToneClassName(tone),
          )}
        >
          {icon ? icon : <span className="text-sm font-semibold">{label.slice(0, 1)}</span>}
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {meta ? <p className="text-xs font-semibold text-cyan-600">{meta}</p> : null}
      </div>
    </div>
  );
}
