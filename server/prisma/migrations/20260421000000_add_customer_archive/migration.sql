ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_RESTORED';

ALTER TABLE "customers" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "customers_tenant_id_archived_at_idx" ON "customers"("tenant_id", "archived_at");
