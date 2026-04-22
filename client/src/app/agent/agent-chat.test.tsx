import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { AgentChat } from "@/app/agent/agent-chat";
import {
  consumeMessageStream,
  createConversationRequest,
  getConversationRequest,
  listConversationsRequest,
  openMessageStreamRequest,
} from "@/features/agent";
import { useAuthStore } from "@/store/auth-store";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/agent", () => ({
  consumeMessageStream: vi.fn(),
  createConversationRequest: vi.fn(),
  listConversationsRequest: vi.fn(),
  getConversationRequest: vi.fn(),
  openMessageStreamRequest: vi.fn(),
}));

describe("AgentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(listConversationsRequest).mockResolvedValue([]);
    vi.mocked(getConversationRequest).mockResolvedValue({
      id: "conversation-1",
      messages: [],
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    vi.mocked(createConversationRequest).mockResolvedValue({
      id: "conversation-1",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "owner@acme.example",
        displayName: "Owner",
      },
      currentTenant: {
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        role: "OWNER",
      },
      availableTenants: [],
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      withAccessTokenRetry: async <T,>(request: (accessToken: string) => Promise<T>) => {
        try {
          return await request("expired-token");
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 401) {
            return request("fresh-token");
          }
          throw error;
        }
      },
    });
  });

  it("retries opening the message stream after a 401 and then consumes the stream", async () => {
    vi.mocked(openMessageStreamRequest)
      .mockRejectedValueOnce(new ApiClientError(401, "expired"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.mocked(consumeMessageStream).mockImplementation(async (_response, callbacks) => {
      callbacks.onTextDelta("已刷新 token。");
      callbacks.onDone();
    });

    const user = userEvent.setup();
    render(<AgentChat />);

    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute("aria-expanded", "false");

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "hello",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(openMessageStreamRequest).toHaveBeenCalledTimes(2);
    });

    expect(vi.mocked(openMessageStreamRequest).mock.calls[0]?.[0]).toBe("expired-token");
    expect(vi.mocked(openMessageStreamRequest).mock.calls[1]?.[0]).toBe("fresh-token");
    expect(consumeMessageStream).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("已刷新 token。")).toBeInTheDocument();
  });

  it("renders typed job update proposals with the service address", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValueOnce(new Response("ok"));
    vi.mocked(consumeMessageStream).mockImplementation(async (_response, callbacks) => {
      callbacks.onToolResult("save_typed_proposal", {
        proposal: {
          id: "proposal-1",
          conversationId: "conversation-1",
          type: "UPDATE_JOB",
          intent: "update_job",
          target: {
            customerId: "customer-1",
            jobId: "job-1",
          },
          customer: {
            status: "matched",
            matchedCustomerId: "customer-1",
            matches: [{ id: "customer-1", name: "Archie Wright" }],
          },
          jobDraft: {
            existingJobId: "job-1",
            title: "Dishwasher leak investigation - Stirling",
            serviceAddress: "10 Mount Barker Road, Stirling SA 5152",
            description: "Updated access note: side gate is open.",
          },
          scheduleDraft: {
            timezone: "Australia/Adelaide",
          },
          warnings: [],
          confidence: 0.91,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      });
      callbacks.onTextDelta("提案已保存。");
      callbacks.onDone();
    });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "更新 Archie Wright 的洗碗机工单地址",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("10 Mount Barker Road, Stirling SA 5152"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Confirming this proposal updates the existing job instead of creating a duplicate."),
    ).toBeInTheDocument();
  });

  it("restores the active planner conversation after the page remounts", async () => {
    vi.mocked(listConversationsRequest).mockResolvedValueOnce([
      {
        id: "conversation-1",
        preview: "Remember this chat",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(getConversationRequest).mockResolvedValueOnce({
      id: "conversation-1",
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "Remember this chat",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "message-2",
          role: "assistant",
          content: "I will keep this conversation open.",
          createdAt: "2026-04-01T00:00:01.000Z",
        },
      ],
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:01.000Z",
    });
    window.sessionStorage.setItem(
      "opsflow:agent:activeConversation:tenant-1:user-1",
      "conversation-1",
    );

    const user = userEvent.setup();
    render(<AgentChat />);

    expect(await screen.findAllByText("Remember this chat")).toHaveLength(2);
    expect(screen.getByText("I will keep this conversation open.")).toBeInTheDocument();
    expect(getConversationRequest).toHaveBeenCalledWith("expired-token", "conversation-1");

    await user.click(screen.getByRole("button", { name: "New" }));

    expect(
      window.sessionStorage.getItem("opsflow:agent:activeConversation:tenant-1:user-1"),
    ).toBeNull();
    expect(
      screen.getByText("Dispatch planning with your live workspace data"),
    ).toBeInTheDocument();
  });
});
