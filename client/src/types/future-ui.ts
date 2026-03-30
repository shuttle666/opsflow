import type { JobStatus } from "@/types/job";

export type TimelineItemView = {
  id: string;
  label: string;
  status: JobStatus;
  timestamp?: string | null;
  description?: string;
  state: "completed" | "current" | "upcoming";
};

export type TransitionActionView = {
  id: string;
  label: string;
  toStatus: JobStatus;
  requiresReason?: boolean;
  requiresNote?: boolean;
  disabled?: boolean;
};

export type AttachmentItemView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeLabel: string;
  uploadedAt: string;
  uploadedBy: string;
  canDownload?: boolean;
  canDelete?: boolean;
};
