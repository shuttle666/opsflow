-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'JOB_ASSIGNED',
    'JOB_UNASSIGNED',
    'JOB_STATUS_CHANGED',
    'JOB_COMPLETION_SUBMITTED',
    'JOB_COMPLETION_APPROVED',
    'JOB_COMPLETION_RETURNED'
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenant_id_recipient_user_id_read_at_created_at_idx"
ON "notifications"("tenant_id", "recipient_user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_recipient_user_id_created_at_idx"
ON "notifications"("tenant_id", "recipient_user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_target_type_target_id_idx"
ON "notifications"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipient_user_id_fkey"
FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
