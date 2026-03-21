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
    <section className={`${surfaceClassName} p-6`}>
      {title || description ? (
        <div className="space-y-2">
          {title ? <h2 className="text-lg font-bold text-slate-900">{title}</h2> : null}
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
      ) : null}

      {toolbar ? <div className={title || description ? "mt-6" : ""}>{toolbar}</div> : null}
      {feedback ? <div className="mt-4">{feedback}</div> : null}

      <div className="mt-5 overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-sm">
        {children}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
