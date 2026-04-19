type InlineErrorBannerProps = {
  message: string;
};

export function InlineErrorBanner({ message }: InlineErrorBannerProps) {
  return (
    <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-sm">
      {message}
    </div>
  );
}
