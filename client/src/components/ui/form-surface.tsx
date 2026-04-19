import { strongSurfaceClassName } from "@/components/ui/styles";

type FormSurfaceProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function FormSurface({
  eyebrow,
  title,
  description,
  children,
}: FormSurfaceProps) {
  return (
    <section className={`${strongSurfaceClassName} p-6 sm:p-8`}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase text-[var(--color-brand)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-8">{children}</div>
    </section>
  );
}

type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
        {description ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type FormActionsProps = {
  children: React.ReactNode;
};

export function FormActions({ children }: FormActionsProps) {
  return <div className="flex flex-wrap items-center gap-3 pt-1">{children}</div>;
}
