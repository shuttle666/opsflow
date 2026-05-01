import type Anthropic from "@anthropic-ai/sdk";

export type AiProviderName = "anthropic" | "openai";
export type AiAgentProfileName = "dispatch_planner";
export type AiIntentExtractorProviderName = "openai";

export type AiAgentProfile = {
  name: AiAgentProfileName;
  provider: AiProviderName;
  model: string;
  maxTokens: number;
  maxIterations: number;
  temperature?: number;
};

export type AiIntentExtractorProfile = {
  enabled: boolean;
  provider: AiIntentExtractorProviderName;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
};

export type AiMessage = Anthropic.MessageParam;
export type AiToolDefinition = Anthropic.Tool;
export type AiToolResultBlock = Anthropic.ToolResultBlockParam;

export type AiProviderStreamEvent = {
  type: "text_delta";
  text: string;
};

export type AiProviderFinalMessage = {
  stopReason: Anthropic.Message["stop_reason"];
  content: Anthropic.Message["content"];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type AiProviderStream = AsyncIterable<AiProviderStreamEvent> & {
  finalMessage: () => Promise<AiProviderFinalMessage>;
};

export type AiProviderStreamInput = {
  profile: AiAgentProfile;
  system: string;
  messages: AiMessage[];
  tools: AiToolDefinition[];
};

export type AiProvider = {
  name: AiProviderName;
  streamMessages: (input: AiProviderStreamInput) => Promise<AiProviderStream>;
};
