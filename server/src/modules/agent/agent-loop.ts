import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import type { AuthContext } from "../../types/auth";
import type { DispatchProposal } from "./agent.service";
import { executeTool, getToolDefinitions } from "./agent-tools";

const MAX_ITERATIONS = 10;

type AgentCallbacks = {
  onTextDelta: (text: string) => void;
  onToolUse: (toolName: string, input: unknown) => void;
  onToolResult: (toolName: string, result: unknown) => void;
  onProposal: (proposal: DispatchProposal) => void;
};

type AgentLoopResult = {
  fullText: string;
  messages: Anthropic.MessageParam[];
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
  proposal?: DispatchProposal;
};

function buildSystemPrompt(timezone: string): string {
  return `You are the Dispatch Planner for OpsFlow, a field operations management platform.

Your job is to help a manager prepare confirm-first operational proposals, not to directly execute business mutations.

Capabilities:
- Search customers
- Search jobs
- Search active team members
- Check activity feed
- Check schedule conflicts
- Save a structured dispatch proposal for manager confirmation

Rules:
- Always respond in the same language the user writes in.
- Current date/time (UTC): ${new Date().toISOString()}
- User timezone: ${timezone}
- When the user wants to create, schedule, or assign work, you must gather context with read tools first.
- Do not attempt to directly create jobs, assign staff, or transition status.
- When you have enough information, call save_dispatch_proposal exactly once.
- The proposal should include customer resolution, job draft, schedule draft, assignee draft, warnings, and confidence.
- If the user wants to create a customer, you should still prepare a proposal instead of refusing. Use intent="create_customer", set customer.status="new", and include any provided phone, email, address, or notes.
- If the user wants to create both a customer and a job, use customer.status="new" and prepare the job as part of the same proposal.
- If customer or assignee matching is ambiguous, mention it clearly in warnings and keep the proposal confirm-first.
- Assignee resolution rules (strictly follow these for assigneeDraft):
  - "matched": you found exactly one staff member AND have their membershipId. Always include membershipId in the proposal.
  - "ambiguous": you found multiple possible staff members. Include all candidates in matches[]. Do NOT set status="matched".
  - "missing": the requested person was not found, or no assignee was mentioned. Set status="missing". Do NOT set status="matched" without a membershipId.
  - Never set status="matched" without including a valid membershipId — this will cause the confirmation to fail.
- Be concise and operational in your final response.`;
}

export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  auth: AuthContext,
  input: {
    conversationId: string;
    timezone: string;
  },
  callbacks: AgentCallbacks,
): Promise<AgentLoopResult> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const tools = getToolDefinitions(auth);
  const allToolCalls: AgentLoopResult["toolCalls"] = [];
  let fullText = "";
  let proposal: DispatchProposal | undefined;

  const workingMessages = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(input.timezone),
      tools,
      messages: workingMessages,
    });

    const toolUseBlocks: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        callbacks.onTextDelta(event.delta.text);
      }
    }

    const finalMessage = await stream.finalMessage();

    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    workingMessages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    if (finalMessage.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      return {
        fullText,
        messages: workingMessages,
        toolCalls: allToolCalls,
        ...(proposal ? { proposal } : {}),
      };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      callbacks.onToolUse(toolUse.name, toolUse.input);
      const result = await executeTool(auth, toolUse.name, toolUse.input, {
        conversationId: input.conversationId,
      });
      callbacks.onToolResult(toolUse.name, result);

      const maybeProposal = (result as { proposal?: DispatchProposal } | undefined)?.proposal;
      if (maybeProposal) {
        proposal = maybeProposal;
        callbacks.onProposal(maybeProposal);
      }

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

    workingMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  return {
    fullText:
      "I've reached the maximum number of steps for this request. Please try breaking your request into smaller parts.",
    messages: workingMessages,
    toolCalls: allToolCalls,
    ...(proposal ? { proposal } : {}),
  };
}
