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
import { executeTool, getToolDefinitions } from "./agent-tools";
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
Use this as guidance, but still verify business targets with resolver/read tools before saving any proposal.
The extracted fields are hints only; never treat them as database identities.
`
    : "";

  return `You are the Dispatch Planner for OpsFlow, a field operations management platform.

Your job is to help a manager prepare confirm-first operational proposals, not to directly execute business mutations.

Capabilities:
- Classify user intent
- Resolve customer, job, staff, and schedule targets
- Search customers
- Search jobs
- Search active team members
- Check activity feed
- Check schedule conflicts
- Save a typed structured proposal for manager confirmation

Rules:
- Always respond in the same language the user writes in.
- Current date/time (UTC): ${new Date().toISOString()}
- User timezone: ${timezone}
- For natural-language schedule times, do not calculate UTC offsets yourself. Call resolve_time_window with localDate (YYYY-MM-DD), localStartTime (HH:mm), localEndTime (HH:mm), timezone="${timezone}", and localEndDate only if the end date differs. Copy the returned schedule fields into the proposal.
- When the user wants to create, schedule, or assign work, you must gather context with read tools first.
- Do not attempt to directly create jobs, assign staff, or transition status.
- For write-like requests, use the router preclassification above when present. If it is absent, call classify_intent. Then resolve the relevant targets before saving a proposal.
- Prefer save_typed_proposal for new proposals. Use save_dispatch_proposal only for legacy dispatch flows.
- The proposal should include a typed proposal type, resolved targets, customer resolution, job draft, schedule draft, assignee draft, warnings, and confidence.
- Existing job rule: if the user chooses or refers to an existing job found through list_jobs/get_job_detail, do NOT create a new job. Set intent="update_existing_job" and include that job ID as jobDraft.existingJobId. Keep the current job title in jobDraft.title.
- If multiple existing jobs match a write-like request, do not only ask in chat. Save a typed proposal without target.jobId/jobDraft.existingJobId and include the resolver candidates under review.candidates.jobs. The proposal review panel will let the user choose the correct job.
- When checking schedule conflicts for an existing job, pass excludeJobId=jobDraft.existingJobId.
- If a save proposal tool returns an EXISTING_JOB_REQUIRED error, do not present the failed plan as saved. Use details.candidateJobs to retry with an existing job target when exactly one job is clearly correct; otherwise save a typed unresolved proposal with those jobs under review.candidates.jobs.
- Do not translate or rename an existing job when saving a proposal; preserve the existing job title from list_jobs/get_job_detail.
- Treat addresses as job service locations, not customer profile fields. For new jobs, put the site address in jobDraft.serviceAddress.
- Customer profile proposals must never contain an address. Customer updates may only change name, phone, email, or notes.
- If the user wants to create a customer, you should still prepare a proposal instead of refusing. Use intent="create_customer", set customer.status="new", and include any provided phone, email, or notes.
- If the user wants to create both a customer and a job, use customer.status="new" and prepare the job as part of the same proposal.
- If customer or assignee matching is ambiguous, mention it clearly in warnings and keep the proposal confirm-first.
- Assignee resolution rules (strictly follow these for assigneeDraft):
  - "matched": you found exactly one staff member AND have their membershipId. Always include membershipId in the proposal.
  - "ambiguous": you found multiple possible staff members. Include all candidates in matches[]. Do NOT set status="matched".
  - "missing": the requested person was not found, or no assignee was mentioned. Set status="missing". Do NOT set status="matched" without a membershipId.
  - Never set status="matched" without including a valid membershipId — this will cause the confirmation to fail.
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
  const tools = getToolDefinitions(auth);
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
