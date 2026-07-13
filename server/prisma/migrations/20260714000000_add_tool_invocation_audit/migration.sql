-- CreateEnum
CREATE TYPE "ToolInvocationSource" AS ENUM ('WEB_AGENT', 'MCP');

-- CreateEnum
CREATE TYPE "ToolInvocationStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "tool_invocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "source" "ToolInvocationSource" NOT NULL,
    "invocation_id" TEXT NOT NULL,
    "request_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "status" "ToolInvocationStatus" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error_code" TEXT,
    "proposal_id" TEXT,
    "input_keys" TEXT[],
    "output_keys" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tool_invocations_source_invocation_id_key"
ON "tool_invocations"("source", "invocation_id");

-- CreateIndex
CREATE INDEX "tool_invocations_tenant_id_created_at_idx"
ON "tool_invocations"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_invocations_tenant_id_tool_name_status_created_at_idx"
ON "tool_invocations"("tenant_id", "tool_name", "status", "created_at");

-- CreateIndex
CREATE INDEX "tool_invocations_conversation_id_created_at_idx"
ON "tool_invocations"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "tool_invocations"
ADD CONSTRAINT "tool_invocations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations"
ADD CONSTRAINT "tool_invocations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations"
ADD CONSTRAINT "tool_invocations_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
