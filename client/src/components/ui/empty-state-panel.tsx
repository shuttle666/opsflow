import Link from "next/link";
import { cn, secondaryButtonClassName } from "@/components/ui/styles";

type EmptyStatePanelProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  compact?: boolean;
};

export function EmptyStatePanel({
  title,
  description,
  actionLabel,
  actionHref,
  compact = false,
}: EmptyStatePanelProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-dashed border-sky-200 bg-white/72 text-center shadow-sm",
        compact ? "px-5 py-6" : "px-6 py-10",
      )}
    >
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {actionLabel && actionHref ? (
        <div className="mt-5">
          <Link href={actionHref} className={secondaryButtonClassName}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
