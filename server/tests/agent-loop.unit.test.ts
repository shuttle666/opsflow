import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const loopMocks = vi.hoisted(() => ({
  getToolDefinitions: vi.fn(),
  executeTool: vi.fn(),
  streamFactory: vi.fn(),
}));

vi.mock("../src/modules/agent/agent-tools", () => ({
  getToolDefinitions: loopMocks.getToolDefinitions,
  executeTool: loopMocks.executeTool,
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
    loopMocks.getToolDefinitions.mockReturnValue([]);
    loopMocks.executeTool.mockResolvedValueOnce({ items: [{ id: "customer-1" }] });
    loopMocks.streamFactory
      .mockResolvedValueOnce(
        buildStream(["先查一下客户。"], {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "list_customers",
              input: { q: "王先生" },
            },
          ],
        } as Anthropic.Message),
      )
      .mockResolvedValueOnce(
        buildStream(["已找到客户。"], {
          stop_reason: "end_turn",
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
        onTextDelta,
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
      },
    );

    expect(result.fullText).toBe("先查一下客户。已找到客户。");
    expect(onTextDelta).toHaveBeenCalledWith("先查一下客户。");
    expect(onTextDelta).toHaveBeenCalledWith("已找到客户。");
    expect(result.toolCalls).toEqual([
      {
        name: "list_customers",
        input: { q: "王先生" },
        result: { items: [{ id: "customer-1" }] },
      },
    ]);
  });
});
