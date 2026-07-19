-- CreateEnum
CREATE TYPE "DemoWorkspaceStatus" AS ENUM ('ACTIVE', 'CLEANING');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_DEMO_SESSION_CREATED';

-- CreateTable
CREATE TABLE "demo_workspaces" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_version" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "ai_requests_used" INTEGER NOT NULL DEFAULT 0,
    "status" "DemoWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cleanup_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demo_workspaces_tenant_id_key" ON "demo_workspaces"("tenant_id");

-- CreateIndex
CREATE INDEX "demo_workspaces_status_expires_at_idx" ON "demo_workspaces"("status", "expires_at");

-- CreateIndex
CREATE INDEX "demo_workspaces_status_cleanup_started_at_idx" ON "demo_workspaces"("status", "cleanup_started_at");

-- AddForeignKey
ALTER TABLE "demo_workspaces" ADD CONSTRAINT "demo_workspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "demo_workspace_id" UUID;

-- CreateIndex
CREATE INDEX "users_demo_workspace_id_idx" ON "users"("demo_workspace_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_demo_workspace_id_fkey" FOREIGN KEY ("demo_workspace_id") REFERENCES "demo_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
