import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const loopMocks = vi.hoisted(() => ({
  listTools: vi.fn(),
  executeTool: vi.fn(),
  streamFactory: vi.fn(),
}));

vi.mock("../src/modules/operations-tools", () => ({
  opsFlowToolRegistry: {
    list: loopMocks.listTools,
    execute: loopMocks.executeTool,
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      stream: loopMocks.streamFactory,
    };
  },
}));

import { runAgentLoop } from "../src/modules/agent/agent-loop";

function buildAuth(): AuthContext {
  return {
    userId: "user-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    role: MembershipRole.MANAGER,
  };
}

function buildStream(
  deltas: string[],
  finalMessage: Awaited<ReturnType<Anthropic["messages"]["stream"] extends (...args: never[]) => infer T ? T["finalMessage"] : never>>,
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltas) {
        yield {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text,
          },
        };
      }
    },
    finalMessage: vi.fn().mockResolvedValue(finalMessage),
  };
}

describe("runAgentLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accumulates assistant text across tool-use iterations", async () => {
    loopMocks.listTools.mockReturnValue([]);
    loopMocks.executeTool.mockResolvedValueOnce({ customers: [{ id: "customer-1" }] });
    loopMocks.streamFactory
      .mockResolvedValueOnce(
        buildStream(["先查一下客户。"], {
          stop_reason: "tool_use",
          usage: {
            input_tokens: 100,
            output_tokens: 10,
          },
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "search_customers",
              input: { q: "王先生" },
            },
          ],
        } as Anthropic.Message),
      )
      .mockResolvedValueOnce(
        buildStream(["已找到客户。"], {
          stop_reason: "end_turn",
          usage: {
            input_tokens: 120,
            output_tokens: 15,
          },
          content: [
            {
              type: "text",
              text: "已找到客户。",
            },
          ],
        } as Anthropic.Message),
      );

    const onTextDelta = vi.fn();
    const result = await runAgentLoop(
      [{ role: "user", content: "帮我找一下王先生" }],
      buildAuth(),
      {
        conversationId: "conversation-1",
        timezone: "Australia/Adelaide",
        requestId: "web-agent-request-1",
      },
      {
        onTextDelta,
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
        onProposal: vi.fn(),
      },
    );

    expect(result.fullText).toBe("先查一下客户。已找到客户。");
    expect(onTextDelta).toHaveBeenCalledWith("先查一下客户。");
    expect(onTextDelta).toHaveBeenCalledWith("已找到客户。");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.iterationCount).toBe(2);
    expect(result.tokenUsage).toEqual({
      inputTokens: 220,
      outputTokens: 25,
    });
    expect(loopMocks.streamFactory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
      }),
    );
    expect(result.toolCalls).toEqual([
      {
        name: "search_customers",
        input: { q: "王先生" },
        result: { customers: [{ id: "customer-1" }] },
      },
    ]);
    expect(loopMocks.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          source: "WEB_AGENT",
          requestId: "web-agent-request-1",
          conversationId: "conversation-1",
        }),
      }),
    );
  });

  it("instructs the model to require a later verbatim confirmation", async () => {
    loopMocks.listTools.mockReturnValue([]);
    loopMocks.streamFactory.mockResolvedValueOnce(
      buildStream([], {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Waiting for confirmation." }],
      } as Anthropic.Message),
    );

    await runAgentLoop(
      [{ role: "user", content: "创建一个工作" }],
      buildAuth(),
      { conversationId: "conversation-1", timezone: "Australia/Adelaide" },
      {
        onTextDelta: vi.fn(),
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
        onProposal: vi.fn(),
      },
    );

    expect(loopMocks.streamFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "Pass that latest user message verbatim as confirmationText",
        ),
      }),
    );
    expect(loopMocks.streamFactory.mock.calls[0]?.[0]?.system).toContain(
      "Never call execute_proposal in the same agent run",
    );
    expect(loopMocks.streamFactory.mock.calls[0]?.[0]?.system).toContain(
      "asks a question, requests any change",
    );
  });

  it("passes an LLM-selected explicit confirmation to the execution tool", async () => {
    loopMocks.listTools.mockReturnValue([]);
    loopMocks.executeTool.mockResolvedValueOnce({
      executed: true,
      proposalId: "proposal-1",
      conversationId: "conversation-1",
      status: "CONFIRMED",
      result: { proposalId: "proposal-1", entityType: "job" },
    });
    loopMocks.streamFactory
      .mockResolvedValueOnce(
        buildStream([], {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tool-execute",
              name: "execute_proposal",
              input: {
                proposalId: "proposal-1",
                confirmationText: "就这样执行",
              },
            },
          ],
        } as Anthropic.Message),
      )
      .mockResolvedValueOnce(
        buildStream(["已执行。"], {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "已执行。" }],
        } as Anthropic.Message),
      );

    const result = await runAgentLoop(
      [{ role: "user", content: "就这样执行" }],
      buildAuth(),
      { conversationId: "conversation-1", timezone: "Australia/Adelaide" },
      {
        onTextDelta: vi.fn(),
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
        onProposal: vi.fn(),
      },
    );

    expect(loopMocks.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "execute_proposal",
        arguments: {
          proposalId: "proposal-1",
          confirmationText: "就这样执行",
        },
      }),
    );
    expect(result.toolCalls).toEqual([
      expect.objectContaining({ name: "execute_proposal" }),
    ]);
  });

  it.each(["不要执行", "可以改到下午吗", "这个方案可以再调整吗"])(
    "does not execute when the model treats %s as rejection or revision",
    async (message) => {
      loopMocks.listTools.mockReturnValue([]);
      loopMocks.streamFactory.mockResolvedValueOnce(
        buildStream(["我会保留当前提案。"], {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "我会保留当前提案。" }],
        } as Anthropic.Message),
      );

      await runAgentLoop(
        [{ role: "user", content: message }],
        buildAuth(),
        { conversationId: "conversation-1", timezone: "Australia/Adelaide" },
        {
          onTextDelta: vi.fn(),
          onToolUse: vi.fn(),
          onToolResult: vi.fn(),
          onProposal: vi.fn(),
        },
      );

      expect(loopMocks.executeTool).not.toHaveBeenCalled();
    },
  );
});
