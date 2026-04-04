import { z } from "zod";

export const conversationIdParamSchema = z.object({
  conversationId: z.uuid(),
});

export const proposalIdParamSchema = z.object({
  conversationId: z.uuid(),
  proposalId: z.uuid(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1, "Message is required.").max(4000),
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();

export type ConversationIdParamInput = z.infer<typeof conversationIdParamSchema>;
export type ProposalIdParamInput = z.infer<typeof proposalIdParamSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
