-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('AUTH_REGISTER', 'AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_REFRESH', 'AUTH_LOGOUT', 'AUTH_SWITCH_TENANT', 'TENANT_INVITATION_CREATED', 'TENANT_INVITATION_ACCEPTED', 'RBAC_FORBIDDEN');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_session_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "invited_user_id" UUID,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_tenant_id_revoked_at_idx" ON "auth_sessions"("tenant_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_token_hash_key" ON "tenant_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenant_id_status_idx" ON "tenant_invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_invitations_invited_user_id_status_idx" ON "tenant_invitations"("invited_user_id", "status");

-- CreateIndex
CREATE INDEX "tenant_invitations_email_status_idx" ON "tenant_invitations"("email", "status");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_replaced_by_session_id_fkey" FOREIGN KEY ("replaced_by_session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
