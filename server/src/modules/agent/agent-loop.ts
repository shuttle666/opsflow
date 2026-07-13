import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../types/auth";
import {
  createAiProvider,
  getAiAgentProfile,
  type AiAgentProfile,
  type AiMessage,
  type AiProviderName,
  type AiToolResultBlock,
} from "../ai";
import type { DispatchProposal } from "./agent.service";
import { opsFlowToolRegistry } from "../operations-tools";
import { toAnthropicTool } from "./adapters/anthropic-tool-adapter";
import {
  classifyAgentIntentWithEnhancement,
  type IntentExtractionSummary,
} from "./intent-extractor";
import type { AgentIntentClassification } from "./intent-router";

type AgentCallbacks = {
  onTextDelta: (text: string) => void;
  onToolUse: (toolName: string, input: unknown) => void;
  onToolResult: (toolName: string, result: unknown) => void;
  onProposal: (proposal: DispatchProposal) => void;
};

export type AgentLoopResult = {
  fullText: string;
  messages: AiMessage[];
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
  provider: AiProviderName;
  model: string;
  iterationCount: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  intentClassification?: AgentIntentClassification;
  intentExtraction?: IntentExtractionSummary;
  proposal?: DispatchProposal;
};

function addTokenUsage(
  current: AgentLoopResult["tokenUsage"],
  next: AgentLoopResult["tokenUsage"],
): AgentLoopResult["tokenUsage"] {
  if (!next?.inputTokens && !next?.outputTokens) {
    return current;
  }

  return {
    inputTokens: (current?.inputTokens ?? 0) + (next.inputTokens ?? 0),
    outputTokens: (current?.outputTokens ?? 0) + (next.outputTokens ?? 0),
  };
}

function baseLoopResult(input: {
  profile: AiAgentProfile;
  fullText: string;
  messages: AiMessage[];
  toolCalls: AgentLoopResult["toolCalls"];
  iterationCount: number;
  tokenUsage?: AgentLoopResult["tokenUsage"];
  intentClassification?: AgentIntentClassification;
  intentExtraction?: IntentExtractionSummary;
  proposal?: DispatchProposal;
}): AgentLoopResult {
  return {
    fullText: input.fullText,
    messages: input.messages,
    toolCalls: input.toolCalls,
    provider: input.profile.provider,
    model: input.profile.model,
    iterationCount: input.iterationCount,
    ...(input.tokenUsage ? { tokenUsage: input.tokenUsage } : {}),
    ...(input.intentClassification
      ? { intentClassification: input.intentClassification }
      : {}),
    ...(input.intentExtraction ? { intentExtraction: input.intentExtraction } : {}),
    ...(input.proposal ? { proposal: input.proposal } : {}),
  };
}

function buildSystemPrompt(
  timezone: string,
  intentClassification?: AgentIntentClassification,
): string {
  const routerContext = intentClassification
    ? `\nRouter preclassification for the latest user message:
- intent: ${intentClassification.intent}
- confidence: ${intentClassification.confidence}
- reason: ${intentClassification.reason}
- extracted: ${JSON.stringify(intentClassification.extracted)}
Use this as guidance, but still verify business targets with search/read tools before saving any proposal.
The extracted fields are hints only; never treat them as database identities.
`
    : "";

  return `You are the Dispatch Planner for OpsFlow, a field operations management platform.

Your job is to help a manager prepare confirm-first operational proposals, not to directly execute business mutations.

Capabilities:
- Search and inspect customers and jobs
- Search active staff and check schedule conflicts
- Create narrow, structured proposals for customer and job operations
- Return proposals for explicit manager confirmation in OpsFlow

Rules:
- Always respond in the same language the user writes in.
- Current date/time (UTC): ${new Date().toISOString()}
- User timezone: ${timezone}
- For natural-language schedule times, pass localDate (YYYY-MM-DD), localStartTime (HH:mm), localEndTime (HH:mm), timezone="${timezone}", and localEndDate only when the end date differs. Proposal tools perform deterministic timezone conversion.
- Before changing an existing customer or job, use search/get tools and copy only IDs returned by those tools. Never invent an ID.
- Do not attempt to directly create jobs, assign staff, or transition status.
- Use propose_create_customer and propose_update_customer for customer-only changes.
- Use propose_create_job for a new job. It can include a new customer, schedule, and assignee in one proposal.
- Use propose_update_job only for title, service address, or description changes on an existing job.
- Use propose_dispatch_job for assignment and/or scheduling of an existing job. When both are requested, make one tool call so the user receives one approval.
- Use propose_change_job_status for non-cancellation transitions and propose_cancel_job for cancellation.
- If search returns multiple plausible targets, ask the user to choose before creating a proposal.
- Proposal tools reload current database records and recheck authorization and conflicts. Do not reproduce database snapshots yourself.
- A successful proposal is still pending. Never claim the business change has happened until the user confirms it.
- Be concise and operational in your final response.${routerContext}`;
}

function messageContentToText(content: AiMessage["content"]) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }

      return "";
    })
    .join(" ")
    .trim();
}

function latestUserText(messages: AiMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }

    const text = messageContentToText(message.content);
    if (text) {
      return text;
    }
  }

  return "";
}

export async function runAgentLoop(
  messages: AiMessage[],
  auth: AuthContext,
  input: {
    conversationId: string;
    timezone: string;
  },
  callbacks: AgentCallbacks,
): Promise<AgentLoopResult> {
  const profile = getAiAgentProfile("dispatch_planner");
  const provider = createAiProvider(profile.provider);
  const canonicalTools = opsFlowToolRegistry.list({
    auth,
    audience: "web-agent",
  });
  const tools = canonicalTools.map(toAnthropicTool);
  const allToolCalls: AgentLoopResult["toolCalls"] = [];
  let fullText = "";
  let proposal: DispatchProposal | undefined;
  let tokenUsage: AgentLoopResult["tokenUsage"];
  let iterationCount = 0;
  const enhancedIntent = latestUserText(messages)
    ? await classifyAgentIntentWithEnhancement(latestUserText(messages))
    : undefined;
  const intentClassification = enhancedIntent?.classification;
  const intentExtraction = enhancedIntent?.extraction;

  const workingMessages = [...messages];

  for (let i = 0; i < profile.maxIterations; i += 1) {
    iterationCount = i + 1;
    const stream = await provider.streamMessages({
      profile,
      system: buildSystemPrompt(input.timezone, intentClassification),
      tools,
      messages: workingMessages,
    });

    const toolUseBlocks: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];

    for await (const event of stream) {
      fullText += event.text;
      callbacks.onTextDelta(event.text);
    }

    const finalMessage = await stream.finalMessage();
    tokenUsage = addTokenUsage(tokenUsage, finalMessage.usage);

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

    if (finalMessage.stopReason !== "tool_use" || toolUseBlocks.length === 0) {
      return baseLoopResult({
        profile,
        fullText,
        messages: workingMessages,
        toolCalls: allToolCalls,
        iterationCount,
        tokenUsage,
        intentClassification,
        intentExtraction,
        proposal,
      });
    }

    const toolResults: AiToolResultBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      callbacks.onToolUse(toolUse.name, toolUse.input);
      const result = await opsFlowToolRegistry.execute({
        auth,
        audience: "web-agent",
        toolName: toolUse.name,
        arguments: toolUse.input,
        context: {
          source: "WEB_AGENT",
          invocationId: randomUUID(),
          conversationId: input.conversationId,
        },
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

  return baseLoopResult({
    profile,
    fullText:
      "I've reached the maximum number of steps for this request. Please try breaking your request into smaller parts.",
    messages: workingMessages,
    toolCalls: allToolCalls,
    iterationCount,
    tokenUsage,
    intentClassification,
    intentExtraction,
    proposal,
  });
}
