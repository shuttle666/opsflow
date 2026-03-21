import { cn, surfaceClassName } from "@/components/ui/styles";

type SectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cn(surfaceClassName, "p-6", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
