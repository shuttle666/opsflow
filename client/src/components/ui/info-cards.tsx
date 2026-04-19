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
      return "bg-[var(--color-success-soft)] text-[var(--color-success)] ring-1 ring-[var(--color-app-border)]";
    case "warning":
      return "bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-1 ring-[var(--color-app-border)]";
    case "indigo":
      return "bg-[var(--color-brand-soft)] text-[var(--color-brand)] ring-1 ring-[var(--color-app-border)]";
    case "neutral":
      return "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-app-border)]";
    default:
      return "bg-[var(--color-brand-soft)] text-[var(--color-brand)] ring-1 ring-[var(--color-app-border)]";
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
          <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
        {description ? (
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function SummaryCard(props: InfoCardProps) {
  return <BaseInfoCard {...props} className={cn("p-5", props.className)} />;
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
    <div className={`${surfaceClassName} flex flex-col gap-3 p-5 transition hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-panel-hover)]`}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            statToneClassName(tone),
          )}
        >
          {icon ? icon : <span className="text-sm font-semibold">{label.slice(0, 1)}</span>}
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
      </div>

      <div className="flex flex-col items-start gap-1">
        <p className="font-mono text-3xl font-bold text-[var(--color-text)]">{value}</p>
        {trend !== undefined && trendLabel ? (
          <div className="mt-1 flex items-center gap-1.5">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : trend < 0 ? (
              <TrendingDown className="h-4 w-4 text-rose-500" />
            ) : null}
            <span className={cn("text-xs font-semibold", trend > 0 ? "text-[var(--color-success)]" : trend < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
              {trendLabel}
            </span>
          </div>
        ) : meta ? (
          <p className="text-xs font-semibold text-[var(--color-brand)]">{meta}</p>
        ) : null}
      </div>
    </div>
  );
}
