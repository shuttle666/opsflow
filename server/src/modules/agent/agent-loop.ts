import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import type { AuthContext } from "../../types/auth";
import { getToolDefinitions, executeTool } from "./agent-tools";

const MAX_ITERATIONS = 10;

type AgentCallbacks = {
  onTextDelta: (text: string) => void;
  onToolUse: (toolName: string, input: unknown) => void;
  onToolResult: (toolName: string, result: unknown) => void;
};

type AgentLoopResult = {
  fullText: string;
  messages: Anthropic.MessageParam[];
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
};

function buildSystemPrompt(): string {
  return `You are an AI dispatch assistant for OpsFlow, a field operations management platform.

Your capabilities:
- Search and create customers
- Search, create, and manage jobs/work orders
- Assign jobs to staff members
- Check job status and transition between states
- View team members and activity logs

Guidelines:
- Always respond in the same language the user writes in.
- Current date and time: ${new Date().toISOString()}
- Before creating a job, search for the customer first to get their ID. If the customer doesn't exist, ask the user if they want to create one.
- Before assigning a job, search memberships to find the right staff member's membership ID.
- When listing results, summarize them in a readable format rather than dumping raw data.
- If a tool returns an error, explain the issue to the user in a helpful way.
- Be concise but informative in your responses.`;
}

export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  auth: AuthContext,
  callbacks: AgentCallbacks,
): Promise<AgentLoopResult> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const tools = getToolDefinitions(auth);
  const allToolCalls: AgentLoopResult["toolCalls"] = [];
  let fullText = "";

  // Work with a copy so we don't mutate the original
  const workingMessages = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools,
      messages: workingMessages,
    });

    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    const contentBlocks: Anthropic.ContentBlock[] = [];

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
        callbacks.onTextDelta(event.delta.text);
      }
    }

    const finalMessage = await stream.finalMessage();
    contentBlocks.push(...finalMessage.content);

    // Extract tool use blocks
    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Add assistant message to working messages
    workingMessages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    // If no tool calls, we're done
    if (finalMessage.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      return { fullText, messages: workingMessages, toolCalls: allToolCalls };
    }

    // Execute tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      callbacks.onToolUse(toolUse.name, toolUse.input);
      const result = await executeTool(auth, toolUse.name, toolUse.input);
      callbacks.onToolResult(toolUse.name, result);

      allToolCalls.push({
        name: toolUse.name,
        input: toolUse.input,
        result,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Add tool results to messages
    workingMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  // If we hit max iterations, return what we have
  return {
    fullText: "I've reached the maximum number of steps for this request. Please try breaking your request into smaller parts.",
    messages: workingMessages,
    toolCalls: allToolCalls,
  };
}
