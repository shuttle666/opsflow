import type Anthropic from "@anthropic-ai/sdk";
import type { AuthContext } from "../../types/auth";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>;
  createdAt: Date;
};

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  messages: ConversationMessage[];
  claudeMessages: Anthropic.MessageParam[];
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationSummary = {
  id: string;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
};

const conversations = new Map<string, Conversation>();

// Clean up conversations older than 24 hours every 30 minutes
setInterval(
  () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, conv] of conversations) {
      if (conv.updatedAt.getTime() < cutoff) {
        conversations.delete(id);
      }
    }
  },
  30 * 60 * 1000,
);

export function createConversation(auth: AuthContext): Conversation {
  const id = crypto.randomUUID();
  const now = new Date();
  const conversation: Conversation = {
    id,
    tenantId: auth.tenantId,
    userId: auth.userId,
    messages: [],
    claudeMessages: [],
    createdAt: now,
    updatedAt: now,
  };
  conversations.set(id, conversation);
  return conversation;
}

export function getConversation(
  auth: AuthContext,
  conversationId: string,
): Conversation | null {
  const conv = conversations.get(conversationId);
  if (!conv) return null;
  if (conv.tenantId !== auth.tenantId || conv.userId !== auth.userId) return null;
  return conv;
}

export function listConversations(auth: AuthContext): ConversationSummary[] {
  const result: ConversationSummary[] = [];
  for (const conv of conversations.values()) {
    if (conv.tenantId === auth.tenantId && conv.userId === auth.userId) {
      const firstMessage = conv.messages[0];
      result.push({
        id: conv.id,
        preview: firstMessage?.content.slice(0, 100) ?? "",
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }
  }
  return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function addUserMessage(
  auth: AuthContext,
  conversationId: string,
  content: string,
): ConversationMessage {
  const conv = getConversation(auth, conversationId);
  if (!conv) throw new Error("Conversation not found.");

  const message: ConversationMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date(),
  };

  conv.messages.push(message);
  conv.claudeMessages.push({ role: "user", content });
  conv.updatedAt = new Date();

  return message;
}

export function appendAssistantMessage(
  conversationId: string,
  content: string,
  claudeMessages: Anthropic.MessageParam[],
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>,
): void {
  const conv = conversations.get(conversationId);
  if (!conv) return;

  conv.messages.push({
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    toolCalls,
    createdAt: new Date(),
  });

  // Replace the simple user message with the full claude message history
  // that includes tool calls and results from this turn
  conv.claudeMessages = claudeMessages;
  conv.updatedAt = new Date();
}
