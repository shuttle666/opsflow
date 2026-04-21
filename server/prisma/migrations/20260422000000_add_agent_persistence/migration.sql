-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AgentProposalStatus" AS ENUM ('PENDING', 'CONFIRMING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preview" TEXT NOT NULL DEFAULT '',
    "model_messages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_calls" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "call_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_proposals" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assistant_message_id" UUID,
    "intent" TEXT NOT NULL,
    "status" "AgentProposalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "confirmation_result" JSONB,
    "failure_message" TEXT,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversations_tenant_id_user_id_updated_at_idx"
ON "agent_conversations"("tenant_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "agent_conversations_user_id_updated_at_idx"
ON "agent_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "agent_messages_conversation_id_created_at_idx"
ON "agent_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_calls_conversation_id_created_at_idx"
ON "agent_tool_calls"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_calls_message_id_call_order_idx"
ON "agent_tool_calls"("message_id", "call_order");

-- CreateIndex
CREATE UNIQUE INDEX "agent_proposals_assistant_message_id_key"
ON "agent_proposals"("assistant_message_id");

-- CreateIndex
CREATE INDEX "agent_proposals_conversation_id_status_idx"
ON "agent_proposals"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "agent_proposals_tenant_id_user_id_updated_at_idx"
ON "agent_proposals"("tenant_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "agent_proposals_confirmed_by_id_confirmed_at_idx"
ON "agent_proposals"("confirmed_by_id", "confirmed_at");

-- AddForeignKey
ALTER TABLE "agent_conversations"
ADD CONSTRAINT "agent_conversations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversations"
ADD CONSTRAINT "agent_conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages"
ADD CONSTRAINT "agent_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls"
ADD CONSTRAINT "agent_tool_calls_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls"
ADD CONSTRAINT "agent_tool_calls_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "agent_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_proposals"
ADD CONSTRAINT "agent_proposals_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_proposals"
ADD CONSTRAINT "agent_proposals_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_proposals"
ADD CONSTRAINT "agent_proposals_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_proposals"
ADD CONSTRAINT "agent_proposals_assistant_message_id_fkey"
FOREIGN KEY ("assistant_message_id") REFERENCES "agent_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_proposals"
ADD CONSTRAINT "agent_proposals_confirmed_by_id_fkey"
FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
