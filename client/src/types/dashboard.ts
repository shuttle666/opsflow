import type { JobStatus } from "./job";

export type DashboardAttentionReason =
  | "PENDING_REVIEW"
  | "NEW_JOB"
  | "UNASSIGNED"
  | "SCHEDULE_CONFLICT";

export type DashboardMetrics = {
  todayJobs: number;
  scheduledRows: number;
  assignedJobs: number;
  pendingReview: number;
  unassignedJobs: number;
  activeCrewScheduled: number;
  activeCrewTotal: number;
  needsAttention: number;
  conflictCount: number;
};

export type DashboardScheduleItem = {
  id: string;
  customerName: string;
  customerInitials: string;
  serviceAddress: string;
  jobType: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignee?: string;
  hasConflict: boolean;
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  customer: string;
  status: JobStatus;
  assignee?: string;
  reason: DashboardAttentionReason;
};

export type DashboardSummary = {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
  metrics: DashboardMetrics;
  schedulePreview: DashboardScheduleItem[];
  attentionItems: DashboardAttentionItem[];
};

export type DashboardSummaryQuery = {
  date: string;
  timezoneOffsetMinutes?: number;
  schedulePreviewLimit?: number;
  attentionLimit?: number;
};
