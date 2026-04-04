import {
  ApiClientError,
  apiClient,
  type ApiSuccessResponse,
} from "@/lib/api-client";
import type {
  ConfirmProposalResult,
  ConversationDetail,
  ConversationSummary,
  SSEEvent,
} from "@/types/agent";

function requireData<T>(response: ApiSuccessResponse<T>, fallbackMessage: string) {
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }
  return response.data;
}

function authHeader(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function createConversationRequest(accessToken: string) {
  const response = await apiClient.post<
    ApiSuccessResponse<{ id: string; createdAt: string }>
  >("/agent/conversations", undefined, {
    headers: authHeader(accessToken),
  });
  return requireData(response, "Create conversation response is missing payload.");
}

export async function listConversationsRequest(accessToken: string) {
  const response = await apiClient.get<ApiSuccessResponse<ConversationSummary[]>>(
    "/agent/conversations",
    { headers: authHeader(accessToken) },
  );
  return requireData(response, "List conversations response is missing payload.");
}

export async function getConversationRequest(
  accessToken: string,
  conversationId: string,
) {
  const response = await apiClient.get<ApiSuccessResponse<ConversationDetail>>(
    `/agent/conversations/${conversationId}`,
    { headers: authHeader(accessToken) },
  );
  return requireData(response, "Get conversation response is missing payload.");
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type StreamCallbacks = {
  onTextDelta: (text: string) => void;
  onToolUse: (tool: string, input: unknown) => void;
  onToolResult: (tool: string, result: unknown) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

export async function openMessageStreamRequest(
  accessToken: string,
  conversationId: string,
  content: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(
    `${API_BASE_URL}/agent/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content, timezone }),
      signal,
    },
  );

  if (response.ok) {
    return response;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;
  const errorPayload = payload as { message?: string; details?: unknown } | undefined;
  const text = isJson ? "" : await response.text().catch(() => "");
  const fallbackMessage =
    text.trim() || `API request failed with status ${response.status}`;

  throw new ApiClientError(
    response.status,
    errorPayload?.message ?? fallbackMessage,
    errorPayload?.details,
  );
}

export async function consumeMessageStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<void> {
  let doneCalled = false;
  const finish = () => {
    if (doneCalled) return;
    doneCalled = true;
    callbacks.onDone();
  };

  try {
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("No response body.");
      finish();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent;

          switch (event.type) {
            case "text_delta":
              callbacks.onTextDelta(event.text);
              break;
            case "tool_use":
              callbacks.onToolUse(event.tool, event.input);
              break;
            case "tool_result":
              callbacks.onToolResult(event.tool, event.result);
              break;
            case "error":
              callbacks.onError(event.message);
              break;
            case "proposal":
              callbacks.onToolResult("save_dispatch_proposal", {
                proposal: event.proposal,
              });
              break;
            case "done":
              finish();
              return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    finish();
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      callbacks.onError((error as Error).message ?? "Connection failed.");
    }
    finish();
  }
}

export async function confirmProposalRequest(
  accessToken: string,
  conversationId: string,
  proposalId: string,
) {
  const response = await apiClient.post<ApiSuccessResponse<ConfirmProposalResult>>(
    `/agent/conversations/${conversationId}/proposals/${proposalId}/confirm`,
    undefined,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Confirm proposal response is missing payload.");
}
