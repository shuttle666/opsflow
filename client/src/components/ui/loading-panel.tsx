import { cn } from "@/components/ui/styles";

type LoadingPanelProps = {
  label: string;
  compact?: boolean;
};

export function LoadingPanel({ label, compact = false }: LoadingPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-center text-sm text-[var(--color-text-secondary)] shadow-sm",
        compact ? "px-5 py-5" : "px-6 py-8",
      )}
    >
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-brand)]" />
      <span>{label}</span>
    </div>
  );
}
