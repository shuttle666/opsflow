import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { isExplicitConfirmationText } from "../../agent/confirmation-policy";
import type {
  AiMessage,
  AiProvider,
  AiProviderFinalMessage,
  AiProviderStream,
  AiProviderStreamInput,
} from "./types";

export const FAKE_CREATE_JOB_COMMAND_PREFIX = "[opsflow-e2e:create-job]";

const createJobCommandSchema = z
  .object({
    customer: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    serviceAddress: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).optional(),
  })
  .strict();

type CreateJobCommand = z.infer<typeof createJobCommandSchema>;

type ToolResult = {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
};

type ParsedCommand =
  | { kind: "create_job"; input: CreateJobCommand }
  | { kind: "invalid" }
  | { kind: "none" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function messageText(content: AiMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join(" ")
    .trim();
}

function latestPlainUserMessage(messages: AiMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }

    const text = messageText(message.content);
    if (text) {
      return { index, text };
    }
  }

  return undefined;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function collectToolResults(messages: AiMessage[], startIndex = 0): ToolResult[] {
  const toolUses = new Map<
    string,
    { name: string; input: Record<string, unknown> }
  >();
  const results: ToolResult[] = [];

  for (let index = Math.max(0, startIndex); index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || typeof message.content === "string") {
      continue;
    }

    if (message.role === "assistant") {
      for (const block of message.content) {
        if (block.type !== "tool_use") {
          continue;
        }

        toolUses.set(block.id, {
          name: block.name,
          input: isRecord(block.input) ? block.input : {},
        });
      }
      continue;
    }

    for (const block of message.content) {
      if (block.type !== "tool_result") {
        continue;
      }

      const toolUse = toolUses.get(block.tool_use_id);
      if (!toolUse) {
        continue;
      }

      results.push({
        ...toolUse,
        result: parseJson(block.content),
      });
    }
  }

  return results;
}

function lastToolResult(results: ToolResult[], name: string) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index]?.name === name) {
      return results[index];
    }
  }

  return undefined;
}

function parseCommand(text: string): ParsedCommand {
  if (!text.startsWith(FAKE_CREATE_JOB_COMMAND_PREFIX)) {
    return { kind: "none" };
  }

  const json = text.slice(FAKE_CREATE_JOB_COMMAND_PREFIX.length).trim();
  try {
    const parsed = createJobCommandSchema.safeParse(JSON.parse(json));
    return parsed.success
      ? { kind: "create_job", input: parsed.data }
      : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function textContent(text: string): AiProviderFinalMessage["content"] {
  return [{ type: "text", text, citations: null }];
}

function toolContent(
  id: string,
  name: string,
  input: Record<string, unknown>,
): AiProviderFinalMessage["content"] {
  return [{ type: "tool_use", id, name, input, caller: { type: "direct" } }];
}

function createStream(
  content: AiProviderFinalMessage["content"],
  stopReason: Anthropic.Message["stop_reason"],
  inputMessageCount: number,
): AiProviderStream {
  const text = content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");

  return {
    async *[Symbol.asyncIterator]() {
      if (text) {
        yield { type: "text_delta" as const, text };
      }
    },
    async finalMessage() {
      return {
        stopReason,
        content,
        usage: {
          inputTokens: inputMessageCount,
          outputTokens: content.length,
        },
      };
    },
  };
}

function finalText(input: AiProviderStreamInput, text: string): AiProviderStream {
  return createStream(textContent(text), "end_turn", input.messages.length);
}

function toolUse(
  streamInput: AiProviderStreamInput,
  id: string,
  name: string,
  input: Record<string, unknown>,
): AiProviderStream {
  if (!streamInput.tools.some((tool) => tool.name === name)) {
    return finalText(
      streamInput,
      `The deterministic test scenario requires the ${name} tool.`,
    );
  }

  return createStream(
    toolContent(id, name, input),
    "tool_use",
    streamInput.messages.length,
  );
}

function findProposalId(messages: AiMessage[], beforeIndex: number) {
  const proposalResult = lastToolResult(
    collectToolResults(messages.slice(0, beforeIndex)),
    "propose_create_job",
  )?.result;

  return isRecord(proposalResult) &&
    proposalResult.saved === true &&
    isNonEmptyString(proposalResult.proposalId)
    ? proposalResult.proposalId
    : undefined;
}

function runCreateJobScenario(
  input: AiProviderStreamInput,
  command: CreateJobCommand,
  userMessageIndex: number,
): AiProviderStream {
  const currentTurnResults = collectToolResults(
    input.messages,
    userMessageIndex + 1,
  );
  const proposalResult = lastToolResult(
    currentTurnResults,
    "propose_create_job",
  );

  if (proposalResult) {
    if (
      !isRecord(proposalResult.result) ||
      proposalResult.result.saved !== true ||
      !isNonEmptyString(proposalResult.result.proposalId)
    ) {
      return finalText(
        input,
        "The scripted proposal tool did not return a saved proposal.",
      );
    }

    return finalText(
      input,
      "The proposal is ready for review. Confirm it in a later message or use the Web approval button.",
    );
  }

  const customerSearch = lastToolResult(currentTurnResults, "search_customers");
  if (!customerSearch) {
    return toolUse(input, "fake-search-customers", "search_customers", {
      q: command.customer,
      page: 1,
      pageSize: 10,
    });
  }

  const customers = isRecord(customerSearch.result) &&
      Array.isArray(customerSearch.result.customers)
    ? customerSearch.result.customers.filter(isRecord)
    : [];
  const exactMatches = customers.filter(
    (customer) =>
      typeof customer.name === "string" &&
      customer.name.localeCompare(command.customer, undefined, {
        sensitivity: "accent",
      }) === 0,
  );

  if (
    exactMatches.length !== 1 ||
    typeof exactMatches[0]?.id !== "string"
  ) {
    return finalText(
      input,
      `The scripted customer lookup did not return exactly one match for ${command.customer}.`,
    );
  }

  return toolUse(input, "fake-propose-create-job", "propose_create_job", {
    customer: {
      kind: "existing",
      customerId: exactMatches[0].id,
    },
    title: command.title,
    serviceAddress: command.serviceAddress,
    ...(command.description ? { description: command.description } : {}),
  });
}

function runConfirmationScenario(
  input: AiProviderStreamInput,
  confirmationText: string,
  userMessageIndex: number,
): AiProviderStream {
  const proposalId = findProposalId(input.messages, userMessageIndex);
  if (!proposalId) {
    return finalText(input, "There is no scripted proposal to confirm.");
  }

  const currentTurnResults = collectToolResults(
    input.messages,
    userMessageIndex + 1,
  );
  const execution = lastToolResult(currentTurnResults, "execute_proposal");
  if (execution) {
    if (
      !isRecord(execution.result) ||
      execution.result.executed !== true ||
      execution.result.status !== "CONFIRMED" ||
      execution.result.proposalId !== proposalId
    ) {
      return finalText(
        input,
        "The scripted proposal execution did not return a matching confirmed receipt.",
      );
    }

    return finalText(input, "The proposal was executed successfully.");
  }

  const snapshot = lastToolResult(currentTurnResults, "get_proposal")?.result;
  if (!snapshot) {
    return toolUse(input, "fake-get-proposal", "get_proposal", { proposalId });
  }

  if (!isRecord(snapshot)) {
    return finalText(input, "The scripted proposal state could not be read.");
  }

  if (snapshot.proposalId !== proposalId) {
    return finalText(input, "The scripted proposal state did not match the request.");
  }

  if (snapshot.status === "CONFIRMED") {
    return finalText(input, "The proposal was already executed.");
  }

  if (
    snapshot.status !== "PENDING" ||
    snapshot.approvalMode !== "CONVERSATIONAL_OR_WEB"
  ) {
    return finalText(
      input,
      "This proposal cannot be executed conversationally. Use the Web approval action.",
    );
  }

  return toolUse(input, "fake-execute-proposal", "execute_proposal", {
    proposalId,
    confirmationText,
  });
}

/**
 * A deliberately narrow scripted provider for integration and browser tests.
 * It accepts only the exported test command protocol and never calls a network API.
 */
export function createFakeAiProvider(): AiProvider {
  return {
    name: "fake",
    async streamMessages(input) {
      const latestUserMessage = latestPlainUserMessage(input.messages);
      if (!latestUserMessage) {
        return finalText(input, "The deterministic test provider needs a user message.");
      }

      const command = parseCommand(latestUserMessage.text);
      if (command.kind === "invalid") {
        return finalText(input, "The deterministic create-job command is invalid.");
      }

      if (command.kind === "create_job") {
        return runCreateJobScenario(input, command.input, latestUserMessage.index);
      }

      if (isExplicitConfirmationText(latestUserMessage.text)) {
        return runConfirmationScenario(
          input,
          latestUserMessage.text,
          latestUserMessage.index,
        );
      }

      return finalText(
        input,
        "This deterministic provider only supports scripted OpsFlow E2E scenarios.",
      );
    },
  };
}
