export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const surfaceClassName =
  "rounded-[32px] border border-white/50 bg-white/68 shadow-[var(--shadow-panel)] backdrop-blur-md";

export const strongSurfaceClassName =
  "rounded-[32px] border border-white/55 bg-white/76 shadow-[var(--shadow-floating)] backdrop-blur-md";

export const mutedSurfaceClassName =
  "rounded-[28px] border border-white/45 bg-white/56 shadow-[0_16px_28px_-22px_rgba(8,145,178,0.16)] backdrop-blur-sm";

export const inputClassName =
  "h-11 w-full rounded-[22px] border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";

export const textAreaClassName = `${inputClassName} min-h-28 resize-y py-3`;

export const selectClassName = `${inputClassName} appearance-none pr-10`;

export const primaryButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cyan-500/20 bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_52%,#38bdf8_100%)] px-5 text-sm font-bold tracking-[0.01em] !text-white shadow-[0_20px_36px_-20px_rgba(8,145,178,0.52)] transition hover:border-cyan-400/25 hover:bg-[linear-gradient(135deg,#0e7490_0%,#0891b2_52%,#0ea5e9_100%)] hover:!text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-400 disabled:!text-white disabled:shadow-none";

export const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const subtleButtonClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export const badgeBaseClassName =
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.08em]";

export const darkButtonClassName =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/30 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";
