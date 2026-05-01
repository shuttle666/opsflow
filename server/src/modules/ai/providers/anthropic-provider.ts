import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "../ai-client";
import type {
  AiProvider,
  AiProviderFinalMessage,
  AiProviderStream,
  AiProviderStreamInput,
} from "./types";

function normalizeFinalMessage(message: Anthropic.Message): AiProviderFinalMessage {
  const usage = message.usage as Anthropic.Message["usage"] | undefined;

  return {
    stopReason: message.stop_reason,
    content: message.content,
    ...(usage
      ? {
          usage: {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
          },
        }
      : {}),
  };
}

export function createAnthropicProvider(): AiProvider {
  const client = createAnthropicClient();

  return {
    name: "anthropic",
    async streamMessages(input: AiProviderStreamInput): Promise<AiProviderStream> {
      const stream = await client.messages.stream({
        model: input.profile.model,
        max_tokens: input.profile.maxTokens,
        ...(input.profile.temperature === undefined
          ? {}
          : { temperature: input.profile.temperature }),
        system: input.system,
        tools: input.tools,
        messages: input.messages,
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              yield {
                type: "text_delta" as const,
                text: event.delta.text,
              };
            }
          }
        },
        async finalMessage() {
          return normalizeFinalMessage(await stream.finalMessage());
        },
      };
    },
  };
}
