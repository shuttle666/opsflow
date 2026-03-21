import { cn } from "@/components/ui/styles";

type LoadingPanelProps = {
  label: string;
  compact?: boolean;
};

export function LoadingPanel({ label, compact = false }: LoadingPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-[28px] border border-white/70 bg-white/78 text-center text-sm text-slate-500 shadow-sm",
        compact ? "px-5 py-5" : "px-6 py-8",
      )}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-cyan-500/80" />
      <span>{label}</span>
    </div>
  );
}
