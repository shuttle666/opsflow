export type ChatMessageRole = "user" | "assistant";

export type ChatToolCall = {
  name: string;
  input: unknown;
  result: unknown;
};

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  toolCalls?: ChatToolCall[];
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type SSEEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done" };
