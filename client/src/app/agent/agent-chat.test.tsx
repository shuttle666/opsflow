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
  updateProposalReviewRequest,
} from "@/features/agent";
import { useAuthStore } from "@/store/auth-store";
import type { DispatchProposal } from "@/types/agent";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/agent", () => ({
  consumeMessageStream: vi.fn(),
  createConversationRequest: vi.fn(),
  listConversationsRequest: vi.fn(),
  getConversationRequest: vi.fn(),
  openMessageStreamRequest: vi.fn(),
  updateProposalReviewRequest: vi.fn(),
}));

function pendingScheduleProposal(): DispatchProposal {
  return {
    id: "proposal-conversation-confirm",
    conversationId: "conversation-1",
    type: "SCHEDULE_JOB",
    intent: "schedule_job",
    target: { customerId: "customer-1", jobId: "job-1" },
    customer: {
      status: "matched",
      matchedCustomerId: "customer-1",
      name: "Archie Wright",
      matches: [{ id: "customer-1", name: "Archie Wright" }],
    },
    jobDraft: {
      existingJobId: "job-1",
      title: "Dishwasher leak investigation",
      serviceAddress: "8 Mount Barker Road",
    },
    scheduleDraft: {
      scheduledStartAt: "2026-04-24T00:00:00.000Z",
      scheduledEndAt: "2026-04-24T02:00:00.000Z",
      timezone: "Australia/Adelaide",
    },
    review: { status: "READY", blockers: [], warnings: [] },
    warnings: [],
    confidence: 0.94,
    createdAt: "2026-04-01T00:00:00.000Z",
  };
}

describe("AgentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/agent");
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
    vi.mocked(updateProposalReviewRequest).mockResolvedValue({
      id: "proposal-1",
      conversationId: "conversation-1",
      type: "SCHEDULE_JOB",
      intent: "schedule_job",
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
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: "membership-1",
        userId: "staff-1",
        displayName: "Alex Nguyen",
      },
      review: {
        status: "READY",
        blockers: [],
        warnings: [],
      },
      warnings: [],
      confidence: 0.9,
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
    expect(screen.getByText("What will change")).toBeInTheDocument();
    expect(screen.getByText("Open job #job-1")).toBeInTheDocument();
  });

  it("keeps the current proposal when a later message does not execute it", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValue(new Response("ok"));
    vi.mocked(consumeMessageStream)
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onToolResult("propose_dispatch_job", {
          proposal: pendingScheduleProposal(),
        });
        callbacks.onTextDelta("方案已准备好，请确认。");
        callbacks.onDone();
      })
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onTextDelta("好的，我不会执行，当前方案仍保留待确认。");
        callbacks.onDone();
      });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "安排这个工作",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("button", { name: "Confirm plan" })).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "不要执行",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("好的，我不会执行，当前方案仍保留待确认。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm plan" })).toBeInTheDocument();
  });

  it("clears the proposal and shows the receipt after conversational execution", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValue(new Response("ok"));
    vi.mocked(consumeMessageStream)
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onToolResult("propose_dispatch_job", {
          proposal: pendingScheduleProposal(),
        });
        callbacks.onDone();
      })
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onToolResult("execute_proposal", {
          executed: true,
          proposalId: "proposal-conversation-confirm",
          conversationId: "conversation-1",
          status: "CONFIRMED",
          result: {
            proposalId: "proposal-conversation-confirm",
            proposalType: "SCHEDULE_JOB",
            entityType: "job",
            createdJobId: "job-1",
            createdJobTitle: "Dishwasher leak investigation",
            updatedExistingJob: true,
          },
        });
        callbacks.onTextDelta("已按你的确认执行。");
        callbacks.onDone();
      });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(screen.getByPlaceholderText("Ask the AI Planner..."), "安排这个工作");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("button", { name: "Confirm plan" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ask the AI Planner..."), "可以了");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("link", { name: "Open job" })).toHaveAttribute(
      "href",
      "/jobs/job-1",
    );
    expect(screen.getByText("Dishwasher leak investigation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm plan" })).not.toBeInTheDocument();
  });

  it("keeps the proposal and exposes the Web fallback after execution failure", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValue(new Response("ok"));
    vi.mocked(consumeMessageStream)
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onToolResult("propose_dispatch_job", {
          proposal: pendingScheduleProposal(),
        });
        callbacks.onDone();
      })
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks.onToolResult("execute_proposal", {
          error: true,
          message: "This proposal requires approval in the OpsFlow Web app.",
          code: "PROPOSAL_WEB_APPROVAL_REQUIRED",
          details: {
            approvalUrl:
              "http://localhost:3000/agent?conversationId=conversation-1&proposalId=proposal-conversation-confirm",
          },
        });
        callbacks.onDone();
      });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(screen.getByPlaceholderText("Ask the AI Planner..."), "安排这个工作");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("button", { name: "Confirm plan" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ask the AI Planner..."), "OK");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("This proposal requires approval in the OpsFlow Web app."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review in Web" })).toHaveAttribute(
      "href",
      expect.stringContaining("proposal-conversation-confirm"),
    );
    expect(screen.getByRole("button", { name: "Confirm plan" })).toBeInTheDocument();
  });

  it("lets users hide and reopen the proposal panel", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValueOnce(new Response("ok"));
    vi.mocked(consumeMessageStream).mockImplementation(async (_response, callbacks) => {
      callbacks.onToolResult("save_typed_proposal", {
        proposal: {
          id: "proposal-1",
          conversationId: "conversation-1",
          type: "UPDATE_CUSTOMER",
          intent: "update_customer",
          target: {
            customerId: "customer-1",
          },
          customer: {
            status: "matched",
            matchedCustomerId: "customer-1",
            name: "Mia Chen",
            matches: [{ id: "customer-1", name: "Mia Chen" }],
          },
          jobDraft: {
            title: "Update customer: Mia Chen",
          },
          scheduleDraft: {
            timezone: "Australia/Adelaide",
          },
          changes: [
            {
              field: "phone",
              from: "0412 000 274",
              to: "0412 888 999",
            },
          ],
          review: {
            status: "READY",
            blockers: [],
            warnings: [],
          },
          warnings: [],
          confidence: 0.96,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      });
      callbacks.onDone();
    });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "把 Mia Chen 的电话改成 0412 888 999。",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Confirm plan" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Hide proposal panel"));

    expect(screen.queryByRole("button", { name: "Confirm plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show proposal panel" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show proposal panel" }));

    expect(await screen.findByRole("button", { name: "Confirm plan" })).toBeInTheDocument();
  });

  it("renders unresolved proposal candidates and patches the selected job", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValueOnce(new Response("ok"));
    vi.mocked(consumeMessageStream).mockImplementation(async (_response, callbacks) => {
      callbacks.onToolResult("save_typed_proposal", {
        proposal: {
          id: "proposal-1",
          conversationId: "conversation-1",
          type: "CREATE_JOB",
          intent: "create_job",
          target: {
            customerId: "customer-1",
          },
          customer: {
            status: "matched",
            matchedCustomerId: "customer-1",
            matches: [{ id: "customer-1", name: "Archie Wright" }],
          },
          jobDraft: {
            title: "Dishwasher leak investigation - Stirling",
            serviceAddress: "10 Mount Barker Road, Stirling SA 5152",
          },
          scheduleDraft: {
            timezone: "Australia/Adelaide",
          },
          review: {
            status: "NEEDS_RESOLUTION",
            blockers: ["This looks like an existing job. Select the existing job before confirming."],
            warnings: [],
            candidates: {
              jobs: [
                {
                  id: "job-1",
                  title: "Dishwasher leak investigation - Stirling",
                  serviceAddress: "8 Mount Barker Road, Stirling SA 5152",
                  status: "NEW",
                  scheduledStartAt: null,
                  scheduledEndAt: null,
                  assignedToName: null,
                },
              ],
            },
          },
          warnings: [],
          confidence: 0.82,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      });
      callbacks.onDone();
    });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "安排 Archie Wright 的洗碗机工作",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    const confirmButton = await screen.findByRole("button", { name: "Confirm plan" });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Dishwasher leak investigation - Stirling/ }));

    await waitFor(() => {
      expect(updateProposalReviewRequest).toHaveBeenCalledWith(
        "expired-token",
        "conversation-1",
        "proposal-1",
        { jobId: "job-1" },
      );
    });
  });

  it("patches schedule edits as local wall time in the proposal timezone", async () => {
    vi.mocked(openMessageStreamRequest).mockResolvedValueOnce(new Response("ok"));
    vi.mocked(consumeMessageStream).mockImplementation(async (_response, callbacks) => {
      callbacks.onToolResult("save_typed_proposal", {
        proposal: {
          id: "proposal-1",
          conversationId: "conversation-1",
          type: "SCHEDULE_JOB",
          intent: "schedule_job",
          target: {
            customerId: "customer-1",
            jobId: "job-1",
          },
          customer: {
            status: "matched",
            matchedCustomerId: "customer-1",
            matches: [{ id: "customer-1", name: "Aiden Murphy" }],
          },
          jobDraft: {
            existingJobId: "job-1",
            title: "Leaking kitchen tap - Melbourne",
          },
          scheduleDraft: {
            scheduledStartAt: "2026-04-24T04:30:00.000Z",
            scheduledEndAt: "2026-04-24T06:30:00.000Z",
            timezone: "Australia/Adelaide",
          },
          assigneeDraft: {
            status: "matched",
            membershipId: "membership-1",
            userId: "staff-1",
            displayName: "Sofia Nguyen",
          },
          review: {
            status: "READY",
            blockers: [],
            warnings: [],
          },
          warnings: [],
          confidence: 0.91,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      });
      callbacks.onDone();
    });

    const user = userEvent.setup();
    render(<AgentChat />);

    await user.type(
      screen.getByPlaceholderText("Ask the AI Planner..."),
      "安排 Aiden 的厨房水龙头工作",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    const startInput = await screen.findByLabelText("Start");
    const endInput = screen.getByLabelText("End");
    expect(startInput).toHaveValue("2026-04-24T14:00");
    expect(endInput).toHaveValue("2026-04-24T16:00");

    await user.clear(startInput);
    await user.type(startInput, "2026-04-24T15:00");
    await user.clear(endInput);
    await user.type(endInput, "2026-04-24T17:00");
    await user.click(screen.getByRole("button", { name: "Update time" }));

    await waitFor(() => {
      expect(updateProposalReviewRequest).toHaveBeenCalledWith(
        "expired-token",
        "conversation-1",
        "proposal-1",
        {
          scheduleDraft: {
            localDate: "2026-04-24",
            localStartTime: "15:00",
            localEndTime: "17:00",
            timezone: "Australia/Adelaide",
          },
        },
      );
    });
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
      screen.getByText("What should OpsFlow plan next?"),
    ).toBeInTheDocument();
  });

  it("opens a conversation linked by an external proposal approval URL", async () => {
    window.history.replaceState(
      {},
      "",
      "/agent?conversationId=conversation-linked&proposalId=proposal-linked",
    );
    vi.mocked(listConversationsRequest).mockResolvedValueOnce([
      {
        id: "conversation-linked",
        preview: "External MCP proposal",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(getConversationRequest).mockResolvedValueOnce({
      id: "conversation-linked",
      messages: [
        {
          id: "message-linked",
          role: "assistant",
          content: "External proposal is ready for review.",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    render(<AgentChat />);

    expect(
      await screen.findByText("External proposal is ready for review."),
    ).toBeInTheDocument();
    expect(getConversationRequest).toHaveBeenCalledWith(
      "expired-token",
      "conversation-linked",
    );
  });
});
