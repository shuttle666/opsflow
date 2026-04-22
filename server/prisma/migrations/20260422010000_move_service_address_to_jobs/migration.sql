ALTER TABLE "jobs" ADD COLUMN "service_address" TEXT;

UPDATE "jobs" AS j
SET "service_address" = COALESCE(NULLIF(BTRIM(c."address"), ''), 'Address not captured')
FROM "customers" AS c
WHERE j."customer_id" = c."id"
  AND j."tenant_id" = c."tenant_id";

UPDATE "jobs"
SET "service_address" = 'Address not captured'
WHERE "service_address" IS NULL
  OR BTRIM("service_address") = '';

ALTER TABLE "jobs" ALTER COLUMN "service_address" SET NOT NULL;

CREATE INDEX "jobs_tenant_id_service_address_idx" ON "jobs"("tenant_id", "service_address");

ALTER TABLE "customers" DROP COLUMN "address";
