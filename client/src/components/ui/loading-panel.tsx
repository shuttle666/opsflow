import { cn } from "@/components/ui/styles";

type LoadingPanelProps = {
  label: string;
  compact?: boolean;
};

type LoadingPulseProps = {
  className?: string;
  tone?: "brand" | "inverse";
};

export function LoadingPulse({
  className,
  tone = "brand",
}: LoadingPulseProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="loading-pulse"
      className={cn(
        "h-2.5 w-2.5 shrink-0 animate-pulse rounded-full motion-reduce:animate-none",
        tone === "inverse" ? "bg-white" : "bg-[var(--color-brand)]",
        className,
      )}
    />
  );
}

export function LoadingPanel({ label, compact = false }: LoadingPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-center text-sm text-[var(--color-text-secondary)] shadow-sm",
        compact ? "px-5 py-5" : "px-6 py-8",
      )}
    >
      <LoadingPulse />
      <span>{label}</span>
    </div>
  );
}
