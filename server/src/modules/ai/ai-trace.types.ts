export type AiWorkflowType =
  | "CHAT_AGENT"
  | "JOB_COMPLETION_REVIEW"
  | "SCHEDULE_OPTIMIZATION";

export type AiRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type AiRunTrace = {
  workflowType: AiWorkflowType;
  status: AiRunStatus;
  targetType?: string;
  targetId?: string;
  provider?: string;
  model?: string;
  inputSummary?: string;
  output?: unknown;
  error?: {
    code?: string;
    message: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  estimatedCostUsd?: number;
};
