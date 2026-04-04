import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { AgentChat } from "@/app/agent/agent-chat";
import {
  consumeMessageStream,
  createConversationRequest,
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
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(listConversationsRequest).mockResolvedValue([]);
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
      screen.getByPlaceholderText("Describe the customer, work, preferred time, and assignee..."),
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
});
