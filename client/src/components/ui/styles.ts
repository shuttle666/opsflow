export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const surfaceClassName =
  "rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] text-[var(--color-text)] shadow-[var(--shadow-panel)]";

export const strongSurfaceClassName =
  "rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-strong)] text-[var(--color-text)] shadow-[var(--shadow-floating)]";

export const mutedSurfaceClassName =
  "rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[var(--color-text)] shadow-[var(--shadow-panel)]";

export const inputClassName =
  "h-9 w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-[13px] text-[var(--color-text)] shadow-sm outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand-soft)]";

export const textAreaClassName = `${inputClassName} min-h-28 resize-y py-3`;

export const selectClassName = `${inputClassName} appearance-none pr-10`;

export const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-[var(--color-brand)] px-3.5 text-[13px] font-semibold !text-white shadow-[0_4px_16px_-10px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)] hover:!text-white disabled:cursor-not-allowed disabled:bg-[var(--color-text-muted)] disabled:!text-white disabled:shadow-none";

export const secondaryButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3.5 text-[13px] font-semibold text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-panel-muted)] disabled:cursor-not-allowed disabled:opacity-60";

export const darkSurfacePrimaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white px-3.5 text-[13px] font-semibold text-[#6b4fe0] shadow-sm transition hover:bg-white/90 hover:text-[#523cc5] disabled:cursor-not-allowed disabled:opacity-60";

export const darkSurfaceSecondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 text-[13px] font-semibold !text-white transition hover:bg-white/15 hover:!text-white disabled:cursor-not-allowed disabled:opacity-60";

export const subtleButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border)] bg-transparent px-3 text-[13px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50";

export const badgeBaseClassName =
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold";

export const darkButtonClassName =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 text-[13px] font-semibold text-white shadow-lg shadow-zinc-950/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:shadow-none";
