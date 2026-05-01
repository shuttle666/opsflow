import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { createAnthropicProvider } from "./providers/anthropic-provider";
import type {
  AiAgentProfile,
  AiAgentProfileName,
  AiIntentExtractorProfile,
  AiProvider,
  AiProviderName,
} from "./providers/types";

export function getAiAgentProfile(name: AiAgentProfileName): AiAgentProfile {
  switch (name) {
    case "dispatch_planner":
      return {
        name,
        provider: env.AI_DISPATCH_PLANNER_PROVIDER,
        model: env.AI_DISPATCH_PLANNER_MODEL,
        maxTokens: env.AI_DISPATCH_PLANNER_MAX_TOKENS,
        maxIterations: env.AI_DISPATCH_PLANNER_MAX_ITERATIONS,
        ...(env.AI_DISPATCH_PLANNER_TEMPERATURE === undefined
          ? {}
          : { temperature: env.AI_DISPATCH_PLANNER_TEMPERATURE }),
      };
  }
}

export function getAiIntentExtractorProfile(): AiIntentExtractorProfile {
  return {
    enabled: env.AI_INTENT_EXTRACTOR_ENABLED,
    provider: env.AI_INTENT_EXTRACTOR_PROVIDER,
    model: env.AI_INTENT_EXTRACTOR_MODEL,
    maxTokens: env.AI_INTENT_EXTRACTOR_MAX_TOKENS,
    temperature: env.AI_INTENT_EXTRACTOR_TEMPERATURE,
    timeoutMs: env.AI_INTENT_EXTRACTOR_TIMEOUT_MS,
  };
}

export function createAiProvider(providerName: AiProviderName): AiProvider {
  switch (providerName) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      throw new ApiError(
        503,
        "OpenAI provider is reserved but not implemented yet.",
      );
  }
}

export function assertAiAgentProfileConfigured(name: AiAgentProfileName): void {
  const profile = getAiAgentProfile(name);

  switch (profile.provider) {
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) {
        throw new ApiError(503, "AI agent is not configured.");
      }
      return;
    case "openai":
      throw new ApiError(
        503,
        "OpenAI provider is reserved but not implemented yet.",
      );
  }
}
