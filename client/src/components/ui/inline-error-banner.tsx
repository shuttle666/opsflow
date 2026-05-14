import type { ApiErrorView } from "@/lib/api-client";

type InlineErrorBannerProps = {
  message: string | ApiErrorView;
};

export function InlineErrorBanner({ message }: InlineErrorBannerProps) {
  const content =
    typeof message === "string"
      ? { message }
      : message;

  return (
    <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-sm">
      <p>{content.message}</p>
      {content.requestId ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]/80">
          Request ID: <span className="font-mono">{content.requestId}</span>
        </p>
      ) : null}
    </div>
  );
}
