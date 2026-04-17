export type JobStatus =
  | "NEW"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type JobCompletionReviewStatus = "PENDING" | "APPROVED" | "RETURNED";

export type JobCompletionAiStatus = "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "FAILED";

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
  sort?: "createdAt_desc" | "createdAt_asc" | "scheduledStartAt_asc" | "scheduledStartAt_desc";
};

export type JobCustomerListSummary = {
  id: string;
  name: string;
};

export type JobListItem = {
  id: string;
  title: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
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
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
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

export type JobCompletionReviewItem = {
  id: string;
  jobId: string;
  completionNote: string;
  status: JobCompletionReviewStatus;
  submittedAt: string;
  submittedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  reviewedAt: string | null;
  reviewedBy?: {
    id: string;
    displayName: string;
    email: string;
  };
  reviewNote: string | null;
  aiStatus: JobCompletionAiStatus | null;
  aiSummary: string | null;
  aiFindings: unknown | null;
};

export type JobCompletionReviewMutationResult = {
  job: JobDetail;
  review: JobCompletionReviewItem;
  historyEntry: JobHistoryItem;
  allowedTransitions: JobStatus[];
};

export type SubmitJobCompletionReviewRequest = {
  completionNote: string;
};

export type ReturnJobCompletionReviewRequest = {
  reviewNote: string;
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
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

export type UpdateJobInput = CreateJobInput;

export type ScheduleDayJobItem = {
  id: string;
  title: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  hasConflict: boolean;
  customer: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type ScheduleLane = {
  key: string;
  label: string;
  membershipId?: string;
  userId?: string;
  jobs: ScheduleDayJobItem[];
  hasConflict: boolean;
};

export type ScheduleDayResult = {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  lanes: ScheduleLane[];
  totalJobs: number;
  conflictCount: number;
};

export type ScheduleRangeResult = {
  rangeStart: string;
  rangeEnd: string;
  lanes: ScheduleLane[];
  totalJobs: number;
  conflictCount: number;
};

export type ScheduleConflictItem = {
  id: string;
  title: string;
  status: JobStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  customer: {
    id: string;
    name: string;
  };
};

export type ScheduleConflictCheckResult = {
  hasConflict: boolean;
  conflicts: ScheduleConflictItem[];
};
