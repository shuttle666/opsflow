"use client";

import { useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  cn,
  inputClassName,
  secondaryButtonClassName,
  selectClassName,
  surfaceClassName,
  subtleButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import type { JobEvidenceItem, JobEvidenceKind } from "@/types/job";

type JobEvidencePanelProps = {
  items: JobEvidenceItem[];
  canUpload: boolean;
  isUploading?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onUpload: (input: { kind: JobEvidenceKind; note?: string; file: File }) => Promise<void>;
  onDelete: (evidenceId: string) => Promise<void>;
  onDownload: (evidence: JobEvidenceItem) => Promise<void>;
};

const jobEvidenceKinds: Array<{ value: JobEvidenceKind; label: string }> = [
  { value: "SITE_PHOTO", label: "Site photo" },
  { value: "COMPLETION_PROOF", label: "Completion proof" },
  { value: "CUSTOMER_DOCUMENT", label: "Customer document" },
  { value: "ISSUE_EVIDENCE", label: "Issue evidence" },
];

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const maxEvidenceSizeBytes = 10 * 1024 * 1024;

function formatEvidenceKind(kind: JobEvidenceKind) {
  return jobEvidenceKinds.find((item) => item.value === kind)?.label ?? kind;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function JobEvidencePanel({
  items,
  canUpload,
  isUploading = false,
  isLoading = false,
  error,
  onUpload,
  onDelete,
  onDownload,
}: JobEvidencePanelProps) {
  const [kind, setKind] = useState<JobEvidenceKind>("SITE_PHOTO");
  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const combinedError = error ?? clientError;
  const evidenceCountLabel = useMemo(
    () => (items.length === 1 ? "1 file" : `${items.length} files`),
    [items.length],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setClientError(null);
    setSuccess(null);

    if (!selectedFile) {
      setClientError("Please choose a file before uploading evidence.");
      return;
    }

    if (!allowedMimeTypes.includes(selectedFile.type)) {
      setClientError("Only JPG, PNG, WEBP, and PDF files are supported.");
      return;
    }

    if (selectedFile.size > maxEvidenceSizeBytes) {
      setClientError("Evidence files must be 10 MB or smaller.");
      return;
    }

    await onUpload({
      kind,
      note,
      file: selectedFile,
    });

    setSelectedFile(null);
    setNote("");
    setKind("SITE_PHOTO");
    setSuccess("Evidence uploaded successfully.");
    setIsUploadOpen(false);
    form.reset();
  }

  return (
    <SummaryCard
      eyebrow="Job Evidence"
      title="Field media and proof"
      description="Photos, proof, and documents attached to this work order."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-bold text-[var(--color-text)]">Evidence files</p>
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {evidenceCountLabel}
              </p>
            </div>
            {canUpload ? (
              <button
                type="button"
                aria-expanded={isUploadOpen}
                onClick={() => {
                  setIsUploadOpen((current) => !current);
                  setClientError(null);
                }}
                className={secondaryButtonClassName}
              >
                {isUploadOpen ? "Hide upload" : "Upload evidence"}
              </button>
            ) : null}
          </div>

          {!canUpload ? (
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
              Your current role can review evidence on this job, but cannot upload new files.
            </p>
          ) : isUploadOpen ? (
            <form
              className="mt-4 space-y-3 rounded-lg border border-dashed border-[var(--color-brand)] bg-[var(--color-app-panel)] p-4"
              onSubmit={handleSubmit}
            >
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  Evidence type
                </span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as JobEvidenceKind)}
                  className={selectClassName}
                >
                  {jobEvidenceKinds.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={textAreaClassName}
                  maxLength={300}
                  placeholder="Optional note explaining what this file proves."
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">File</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className={inputClassName}
                  onChange={(event) => {
                    setClientError(null);
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={isUploading} className={secondaryButtonClassName}>
                  {isUploading ? "Uploading..." : "Add evidence"}
                </button>
                {selectedFile ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Ready to upload: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>

        {combinedError ? <InlineErrorBanner message={combinedError} /> : null}
        {success ? <p className="text-sm text-[var(--color-success)]">{success}</p> : null}

        {isLoading ? (
          <LoadingPanel label="Loading evidence..." compact />
        ) : items.length === 0 ? (
          <EmptyStatePanel
            compact
            title="No evidence added yet"
            description="Uploaded files will appear here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(surfaceClassName, "p-4")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        {item.fileName}
                      </p>
                      <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-brand-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--color-brand)]">
                        {formatEvidenceKind(item.kind)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {item.mimeType} | {formatFileSize(item.sizeBytes)}
                    </p>
                    {item.note ? (
                      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                        {item.note}
                      </p>
                    ) : null}
                    <p className="text-xs uppercase text-[var(--color-text-muted)]">
                      {item.uploadedBy.displayName} | {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={subtleButtonClassName}
                      disabled={activeDownloadId === item.id}
                      onClick={async () => {
                        setActiveDownloadId(item.id);
                        setClientError(null);
                        try {
                          await onDownload(item);
                        } catch (downloadError) {
                          setClientError(
                            downloadError instanceof Error
                              ? downloadError.message
                              : "Failed to download evidence.",
                          );
                        } finally {
                          setActiveDownloadId((current) => (current === item.id ? null : current));
                        }
                      }}
                    >
                      {activeDownloadId === item.id ? "Preparing..." : "Download"}
                    </button>
                    {canUpload ? (
                      <button
                        type="button"
                        className={subtleButtonClassName}
                        disabled={activeDeleteId === item.id}
                        onClick={async () => {
                          const confirmed = window.confirm(
                            `Delete evidence "${item.fileName}" from this job?`,
                          );

                          if (!confirmed) {
                            return;
                          }

                          setActiveDeleteId(item.id);
                          setClientError(null);
                          setSuccess(null);

                          try {
                            await onDelete(item.id);
                            setSuccess("Evidence deleted.");
                          } catch (deleteError) {
                            setClientError(
                              deleteError instanceof Error
                                ? deleteError.message
                                : "Failed to delete evidence.",
                            );
                          } finally {
                            setActiveDeleteId((current) => (current === item.id ? null : current));
                          }
                        }}
                      >
                        {activeDeleteId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
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
