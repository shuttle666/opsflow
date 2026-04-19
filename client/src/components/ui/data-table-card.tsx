import { surfaceClassName } from "@/components/ui/styles";

type DataTableCardProps = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  feedback?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function DataTableCard({
  title,
  description,
  toolbar,
  feedback,
  footer,
  children,
}: DataTableCardProps) {
  return (
    <section className={`${surfaceClassName} overflow-hidden p-0`}>
      {title || description ? (
        <div className="space-y-2 border-b border-[var(--color-app-border)] px-4 py-3">
          {title ? <h2 className="text-lg font-bold text-[var(--color-text)]">{title}</h2> : null}
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {toolbar ? <div className="border-b border-[var(--color-app-border)] px-4 py-3">{toolbar}</div> : null}
      {feedback ? <div className="px-4 py-3">{feedback}</div> : null}

      <div className="overflow-hidden bg-[var(--color-app-panel)]">
        {children}
      </div>

      {footer ? <div className="border-t border-[var(--color-app-border)] px-4 py-2.5">{footer}</div> : null}
    </section>
  );
}
