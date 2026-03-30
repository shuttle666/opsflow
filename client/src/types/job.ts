export type JobStatus = "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type JobEvidenceKind =
  | "SITE_PHOTO"
  | "COMPLETION_PROOF"
  | "CUSTOMER_DOCUMENT"
  | "ISSUE_EVIDENCE";

export type AssignJobRequest = {
  membershipId: string;
};

export type JobListQuery = {
  q?: string;
  status?: JobStatus;
  customerId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  page?: number;
  pageSize?: number;
  sort?: "createdAt_desc" | "createdAt_asc" | "scheduledAt_asc" | "scheduledAt_desc";
};

export type JobCustomerListSummary = {
  id: string;
  name: string;
};

export type JobListItem = {
  id: string;
  title: string;
  status: JobStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: JobCustomerListSummary;
  assignedToName?: string;
};

export type JobCustomerDetailSummary = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type JobDetail = {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: JobCustomerDetailSummary;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type JobHistoryItem = {
  id: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  reason: string | null;
  changedAt: string;
  changedBy?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type JobHistoryResult = {
  history: JobHistoryItem[];
  allowedTransitions: JobStatus[];
};

export type JobStatusTransitionRequest = {
  toStatus: JobStatus;
  reason?: string;
};

export type JobStatusTransitionResult = {
  job: JobDetail;
  historyEntry: JobHistoryItem;
  allowedTransitions: JobStatus[];
};

export type JobEvidenceItem = {
  id: string;
  kind: JobEvidenceKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  downloadPath: string;
  uploadedBy: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type UploadJobEvidenceInput = {
  kind: JobEvidenceKind;
  note?: string;
  file: File;
};

export type CreateJobInput = {
  customerId: string;
  title: string;
  description?: string;
  scheduledAt?: string;
};

export type UpdateJobInput = CreateJobInput;
