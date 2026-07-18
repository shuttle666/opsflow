import type Anthropic from "@anthropic-ai/sdk";
import {
  createFakeAiProvider,
  FAKE_CREATE_JOB_COMMAND_PREFIX,
} from "../src/modules/ai/providers/fake-provider";
import type {
  AiMessage,
  AiProviderFinalMessage,
  AiProviderStreamInput,
} from "../src/modules/ai/providers/types";

const tools = [
  "search_customers",
  "propose_create_job",
  "get_proposal",
  "execute_proposal",
].map(
  (name) =>
    ({
      name,
      description: `${name} test tool`,
      input_schema: { type: "object", properties: {} },
    }) satisfies Anthropic.Tool,
);

const profile = {
  name: "dispatch_planner" as const,
  provider: "fake" as const,
  model: "opsflow-scripted-e2e-v1",
  maxTokens: 100,
  maxIterations: 10,
};

const createJobCommand = `${FAKE_CREATE_JOB_COMMAND_PREFIX} ${JSON.stringify({
  customer: "Aiden Murphy",
  title: "E2E AI Proposal Job",
  serviceAddress: "18 Collins Street, Melbourne VIC 3000",
  description: "Created by the deterministic provider.",
})}`;

function streamInput(messages: AiMessage[]): AiProviderStreamInput {
  return {
    profile,
    system: "Test system prompt",
    messages,
    tools,
  };
}

async function runProvider(messages: AiMessage[]) {
  const stream = await createFakeAiProvider().streamMessages(streamInput(messages));
  let streamedText = "";
  for await (const event of stream) {
    streamedText += event.text;
  }

  return {
    streamedText,
    final: await stream.finalMessage(),
  };
}

function appendAssistant(
  messages: AiMessage[],
  final: AiProviderFinalMessage,
): void {
  messages.push({
    role: "assistant",
    content: final.content as Anthropic.ContentBlockParam[],
  });
}

function appendToolResult(
  messages: AiMessage[],
  toolUseId: string,
  result: unknown,
): void {
  messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: JSON.stringify(result),
      },
    ],
  });
}

describe("fake AI provider", () => {
  it("deterministically searches, proposes a job, and stops for approval", async () => {
    const messages: AiMessage[] = [{ role: "user", content: createJobCommand }];

    const search = await runProvider(messages);
    expect(search.final.stopReason).toBe("tool_use");
    expect(search.final.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        id: "fake-search-customers",
        name: "search_customers",
        input: {
          q: "Aiden Murphy",
          page: 1,
          pageSize: 10,
        },
      }),
    ]);
    appendAssistant(messages, search.final);
    appendToolResult(messages, "fake-search-customers", {
      customers: [
        {
          id: "10000000-0000-4000-8000-000000000101",
          name: "Aiden Murphy",
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    const proposal = await runProvider(messages);
    expect(proposal.final.stopReason).toBe("tool_use");
    expect(proposal.final.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        id: "fake-propose-create-job",
        name: "propose_create_job",
        input: {
          customer: {
            kind: "existing",
            customerId: "10000000-0000-4000-8000-000000000101",
          },
          title: "E2E AI Proposal Job",
          serviceAddress: "18 Collins Street, Melbourne VIC 3000",
          description: "Created by the deterministic provider.",
        },
      }),
    ]);
    appendAssistant(messages, proposal.final);
    appendToolResult(messages, "fake-propose-create-job", {
      saved: true,
      proposalId: "30000000-0000-4000-8000-000000000001",
    });

    const waiting = await runProvider(messages);
    expect(waiting.final.stopReason).toBe("end_turn");
    expect(waiting.streamedText).toContain("ready for review");
    expect(waiting.final.content).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "execute_proposal" }),
      ]),
    );
  });

  it("reads proposal state before executing a later explicit confirmation", async () => {
    const proposalId = "30000000-0000-4000-8000-000000000001";
    const messages: AiMessage[] = [
      { role: "user", content: createJobCommand },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "fake-propose-create-job",
            name: "propose_create_job",
            input: {},
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "fake-propose-create-job",
            content: JSON.stringify({ saved: true, proposalId }),
          },
        ],
      },
      {
        role: "assistant",
        content: "The proposal is ready for review.",
      },
      { role: "user", content: "CONFIRM!" },
    ];

    const getProposal = await runProvider(messages);
    expect(getProposal.final.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        name: "get_proposal",
        input: { proposalId },
      }),
    ]);
    appendAssistant(messages, getProposal.final);
    appendToolResult(messages, "fake-get-proposal", {
      proposalId,
      status: "PENDING",
      approvalMode: "CONVERSATIONAL_OR_WEB",
    });

    const execute = await runProvider(messages);
    expect(execute.final.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        name: "execute_proposal",
        input: {
          proposalId,
          confirmationText: "CONFIRM!",
        },
      }),
    ]);
    appendAssistant(messages, execute.final);
    appendToolResult(messages, "fake-execute-proposal", {
      executed: true,
      proposalId,
      status: "CONFIRMED",
    });

    const receipt = await runProvider(messages);
    expect(receipt.final.stopReason).toBe("end_turn");
    expect(receipt.streamedText).toBe("The proposal was executed successfully.");
  });

  it("does not infer tool calls from ordinary user text", async () => {
    const response = await runProvider([
      { role: "user", content: "Please create a job for someone." },
    ]);

    expect(response.final.stopReason).toBe("end_turn");
    expect(response.streamedText).toContain("only supports scripted");
    expect(response.final.content).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "tool_use" })]),
    );
  });

  it.each([
    { error: "Proposal validation failed." },
    { saved: false, proposalId: "30000000-0000-4000-8000-000000000001" },
    { saved: true },
    { saved: true, proposalId: "" },
  ])("does not treat a malformed proposal result as saved: %j", async (result) => {
    const messages: AiMessage[] = [{ role: "user", content: createJobCommand }];
    const search = await runProvider(messages);
    appendAssistant(messages, search.final);
    appendToolResult(messages, "fake-search-customers", {
      customers: [
        {
          id: "10000000-0000-4000-8000-000000000101",
          name: "Aiden Murphy",
        },
      ],
    });
    const proposal = await runProvider(messages);
    appendAssistant(messages, proposal.final);
    appendToolResult(messages, "fake-propose-create-job", result);

    const response = await runProvider(messages);
    expect(response.final.stopReason).toBe("end_turn");
    expect(response.streamedText).toContain(
      "did not return a saved proposal",
    );
    expect(response.streamedText).not.toContain("ready for review");
  });

  it.each([
    { error: "Execution failed." },
    {
      executed: false,
      status: "PENDING",
      proposalId: "30000000-0000-4000-8000-000000000001",
    },
    {
      executed: true,
      status: "CONFIRMED",
      proposalId: "30000000-0000-4000-8000-000000000099",
    },
  ])("does not report malformed execution result as successful: %j", async (result) => {
    const proposalId = "30000000-0000-4000-8000-000000000001";
    const messages: AiMessage[] = [
      { role: "user", content: createJobCommand },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "fake-propose-create-job",
            name: "propose_create_job",
            input: {},
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "fake-propose-create-job",
            content: JSON.stringify({ saved: true, proposalId }),
          },
        ],
      },
      { role: "assistant", content: "Waiting for confirmation." },
      { role: "user", content: "Confirm" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "fake-get-proposal",
            name: "get_proposal",
            input: { proposalId },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "fake-get-proposal",
            content: JSON.stringify({
              proposalId,
              status: "PENDING",
              approvalMode: "CONVERSATIONAL_OR_WEB",
            }),
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "fake-execute-proposal",
            name: "execute_proposal",
            input: { proposalId, confirmationText: "Confirm" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "fake-execute-proposal",
            content: JSON.stringify(result),
          },
        ],
      },
    ];

    const response = await runProvider(messages);
    expect(response.final.stopReason).toBe("end_turn");
    expect(response.streamedText).toContain(
      "did not return a matching confirmed receipt",
    );
    expect(response.streamedText).not.toContain("executed successfully");
  });

  it("stops when customer search is ambiguous", async () => {
    const messages: AiMessage[] = [{ role: "user", content: createJobCommand }];
    const search = await runProvider(messages);
    appendAssistant(messages, search.final);
    appendToolResult(messages, "fake-search-customers", {
      customers: [
        { id: "customer-1", name: "Aiden Murphy" },
        { id: "customer-2", name: "Aiden Murphy" },
      ],
    });

    const response = await runProvider(messages);
    expect(response.final.stopReason).toBe("end_turn");
    expect(response.streamedText).toContain("exactly one match");
  });
});
