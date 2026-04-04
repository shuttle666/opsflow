ALTER TABLE "jobs"
ADD COLUMN "scheduled_start_at" TIMESTAMP(3),
ADD COLUMN "scheduled_end_at" TIMESTAMP(3);

UPDATE "jobs"
SET
  "scheduled_start_at" = "scheduled_at",
  "scheduled_end_at" = "scheduled_at" + INTERVAL '60 minutes'
WHERE "scheduled_at" IS NOT NULL;

CREATE INDEX "jobs_tenant_id_scheduled_start_at_idx"
ON "jobs"("tenant_id", "scheduled_start_at");

CREATE INDEX "jobs_tenant_id_assigned_to_id_scheduled_start_at_idx"
ON "jobs"("tenant_id", "assigned_to_id", "scheduled_start_at");
