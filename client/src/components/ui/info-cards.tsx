import { TrendingUp, TrendingDown } from "@/components/ui/icons";
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
  trend?: number;
  trendLabel?: string;
};

function statToneClassName(tone: NonNullable<StatCardProps["tone"]>) {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80";
    case "warning":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80";
    case "indigo":
      return "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/80";
    case "neutral":
      return "bg-slate-200 text-slate-600 ring-1 ring-slate-300/80";
    default:
      return "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80";
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
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className={`${surfaceClassName} flex flex-col gap-3 p-5 transition-shadow hover:shadow-[0_20px_44px_-28px_rgba(6,182,212,0.18)]`}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            statToneClassName(tone),
          )}
        >
          {icon ? icon : <span className="text-sm font-semibold">{label.slice(0, 1)}</span>}
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>

      <div className="flex flex-col items-start gap-1">
        <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {trend !== undefined && trendLabel ? (
          <div className="mt-1 flex items-center gap-1.5">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : trend < 0 ? (
              <TrendingDown className="h-4 w-4 text-rose-500" />
            ) : null}
            <span className={cn("text-xs font-semibold", trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-600" : "text-slate-400")}>
              {trendLabel}
            </span>
          </div>
        ) : meta ? (
          <p className="text-xs font-semibold text-cyan-600">{meta}</p>
        ) : null}
      </div>
    </div>
  );
}
