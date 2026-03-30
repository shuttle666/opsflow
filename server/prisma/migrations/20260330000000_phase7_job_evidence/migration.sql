-- CreateEnum
CREATE TYPE "JobEvidenceKind" AS ENUM ('SITE_PHOTO', 'COMPLETION_PROOF', 'CUSTOMER_DOCUMENT', 'ISSUE_EVIDENCE');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'JOB_EVIDENCE_UPLOADED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'JOB_EVIDENCE_DELETED';

-- CreateTable
CREATE TABLE "job_evidence" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "kind" "JobEvidenceKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_evidence_id_tenant_id_key" ON "job_evidence"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "job_evidence_tenant_id_idx" ON "job_evidence"("tenant_id");

-- CreateIndex
CREATE INDEX "job_evidence_job_id_created_at_idx" ON "job_evidence"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "job_evidence_uploaded_by_id_created_at_idx" ON "job_evidence"("uploaded_by_id", "created_at");

-- AddForeignKey
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_job_id_tenant_id_fkey" FOREIGN KEY ("job_id", "tenant_id") REFERENCES "jobs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
