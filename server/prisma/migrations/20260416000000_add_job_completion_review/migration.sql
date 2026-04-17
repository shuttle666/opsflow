ALTER TYPE "JobStatus" ADD VALUE 'PENDING_REVIEW';

ALTER TYPE "AuditAction" ADD VALUE 'JOB_COMPLETION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_COMPLETION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_COMPLETION_RETURNED';

CREATE TYPE "JobCompletionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

CREATE TYPE "JobCompletionAiStatus" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_REVIEW', 'FAILED');

CREATE TABLE "job_completion_reviews" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "submitted_by_id" UUID NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completion_note" TEXT NOT NULL,
  "status" "JobCompletionReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "ai_status" "JobCompletionAiStatus",
  "ai_summary" TEXT,
  "ai_findings" JSONB,

  CONSTRAINT "job_completion_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_completion_reviews_id_tenant_id_key"
ON "job_completion_reviews"("id", "tenant_id");

CREATE INDEX "job_completion_reviews_tenant_id_idx"
ON "job_completion_reviews"("tenant_id");

CREATE INDEX "job_completion_reviews_job_id_submitted_at_idx"
ON "job_completion_reviews"("job_id", "submitted_at");

CREATE INDEX "job_completion_reviews_submitted_by_id_submitted_at_idx"
ON "job_completion_reviews"("submitted_by_id", "submitted_at");

CREATE INDEX "job_completion_reviews_reviewed_by_id_reviewed_at_idx"
ON "job_completion_reviews"("reviewed_by_id", "reviewed_at");

ALTER TABLE "job_completion_reviews"
ADD CONSTRAINT "job_completion_reviews_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_completion_reviews"
ADD CONSTRAINT "job_completion_reviews_job_id_tenant_id_fkey"
FOREIGN KEY ("job_id", "tenant_id") REFERENCES "jobs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_completion_reviews"
ADD CONSTRAINT "job_completion_reviews_submitted_by_id_fkey"
FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_completion_reviews"
ADD CONSTRAINT "job_completion_reviews_reviewed_by_id_fkey"
FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
