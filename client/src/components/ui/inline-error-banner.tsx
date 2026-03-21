type InlineErrorBannerProps = {
  message: string;
};

export function InlineErrorBanner({ message }: InlineErrorBannerProps) {
  return (
    <div className="rounded-[22px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm">
      {message}
    </div>
  );
}
