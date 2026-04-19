import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  secondaryButtonClassName,
  subtleButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import type { AttachmentItemView } from "@/types/future-ui";

type AttachmentPanelProps = {
  items: AttachmentItemView[];
};

export function AttachmentPanel({ items }: AttachmentPanelProps) {
  return (
    <SummaryCard
      eyebrow="Attachments"
      title="Files and field media"
      description="Upload, preview, and download controls are staged here for the future attachment API."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-[var(--color-brand)] bg-[var(--color-app-panel-muted)] p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">Upload zone</p>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              The UI is ready for drag-and-drop and file picker wiring. Upload
              stays disabled until the Phase 7 attachment endpoints are available.
            </p>
          </div>
          <div className="mt-4">
            <button type="button" disabled className={secondaryButtonClassName}>
              Upload files (coming soon)
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyStatePanel
            compact
            title="No attachments yet"
            description="Once upload support lands, photos, documents, and completion evidence will appear in this list."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`${surfaceClassName} p-4`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.fileName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {item.mimeType} | {item.sizeLabel}
                    </p>
                    <p className="text-xs uppercase text-[var(--color-text-muted)]">
                      {item.uploadedBy} | {item.uploadedAt}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={subtleButtonClassName}>
                      Download
                    </button>
                    <button type="button" className={subtleButtonClassName}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SummaryCard>
  );
}
