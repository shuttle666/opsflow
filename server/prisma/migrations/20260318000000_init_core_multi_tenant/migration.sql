-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "from_status" "JobStatus" NOT NULL,
    "to_status" "JobStatus" NOT NULL,
    "changed_by_id" UUID,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_role_idx" ON "memberships"("tenant_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_created_at_idx" ON "customers"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_id_tenant_id_key" ON "customers"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_idx" ON "jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_status_idx" ON "jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_customer_id_idx" ON "jobs"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_id_tenant_id_key" ON "jobs"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "job_status_history_tenant_id_idx" ON "job_status_history"("tenant_id");

-- CreateIndex
CREATE INDEX "job_status_history_job_id_changed_at_idx" ON "job_status_history"("job_id", "changed_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_job_id_tenant_id_fkey" FOREIGN KEY ("job_id", "tenant_id") REFERENCES "jobs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

