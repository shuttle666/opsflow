import { env } from "../../../config/env";
import { ApiError } from "../../../utils/api-error";
import type { AiIntentExtractorProfile } from "./types";

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export type OpenAiJsonExtractionResult = {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export async function createOpenAiJsonExtraction(input: {
  profile: AiIntentExtractorProfile;
  system: string;
  user: string;
}): Promise<OpenAiJsonExtractionResult> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(503, "OpenAI intent extractor is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.profile.timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.profile.model,
        temperature: input.profile.temperature,
        max_tokens: input.profile.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, "OpenAI intent extractor request failed.");
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ApiError(502, "OpenAI intent extractor returned an empty response.");
    }

    return {
      content,
      ...(payload.usage
        ? {
            usage: {
              inputTokens: payload.usage.prompt_tokens,
              outputTokens: payload.usage.completion_tokens,
            },
          }
        : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}
