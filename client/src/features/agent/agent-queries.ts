"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  DispatchProposal,
  UpdateProposalReviewInput,
} from "@/types/agent";
import {
  confirmProposalRequest,
  createConversationRequest,
  getConversationRequest,
  listConversationsRequest,
  updateProposalReviewRequest,
} from "./agent-api";

type QueryOptions = {
  enabled?: boolean;
};

export function useAgentConversationsQuery(
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.agent.conversations(scope),
    queryFn: (accessToken) => listConversationsRequest(accessToken),
    enabled: enabled && Boolean(scope.tenantId && scope.userId),
  });
}

export function useAgentConversationQuery(
  conversationId: string | null,
  { enabled = true }: QueryOptions = {},
) {
  const scope = useAuthenticatedQueryScope();
  const resolvedConversationId = conversationId ?? "";

  return useAuthenticatedQuery({
    queryKey: queryKeys.agent.conversation(scope, resolvedConversationId),
    queryFn: (accessToken) =>
      getConversationRequest(accessToken, resolvedConversationId),
    staleTime: 30_000,
    enabled:
      enabled &&
      Boolean(scope.tenantId && scope.userId && resolvedConversationId),
  });
}

type ConversationSummaryUpdate = {
  id: string;
  preview?: string;
  createdAt?: string;
  updatedAt: string;
};

export function updateAgentConversationSummaryCache(
  queryClient: QueryClient,
  scope: QueryScope,
  update: ConversationSummaryUpdate,
) {
  queryClient.setQueryData<ConversationSummary[]>(
    queryKeys.agent.conversations(scope),
    (current) => {
      const existing = current?.find((item) => item.id === update.id);
      const next: ConversationSummary = {
        id: update.id,
        preview: update.preview ?? existing?.preview ?? "",
        createdAt: existing?.createdAt ?? update.createdAt ?? update.updatedAt,
        updatedAt: update.updatedAt,
      };

      return [
        next,
        ...(current ?? []).filter((item) => item.id !== update.id),
      ].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
    },
  );
}

export function appendAgentConversationMessageCache(
  queryClient: QueryClient,
  scope: QueryScope,
  conversationId: string,
  message: ChatMessage,
  options: { preview?: string } = {},
) {
  queryClient.setQueryData<ConversationDetail>(
    queryKeys.agent.conversation(scope, conversationId),
    (current) => {
      if (current?.messages.some((item) => item.id === message.id)) {
        return current;
      }

      return {
        id: conversationId,
        messages: [...(current?.messages ?? []), message],
        createdAt: current?.createdAt ?? message.createdAt,
        updatedAt: message.createdAt,
      };
    },
  );
  updateAgentConversationSummaryCache(queryClient, scope, {
    id: conversationId,
    preview: options.preview,
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  });
}

export function updateAgentConversationProposalCache(
  queryClient: QueryClient,
  scope: QueryScope,
  conversationId: string,
  proposal: DispatchProposal,
) {
  queryClient.setQueryData<ConversationDetail>(
    queryKeys.agent.conversation(scope, conversationId),
    (current) =>
      current
        ? {
            ...current,
            messages: current.messages.map((message) =>
              message.proposal?.id === proposal.id
                ? { ...message, proposal }
                : message,
            ),
          }
        : current,
  );
}

export function markAgentConversationListStale(
  queryClient: QueryClient,
  scope: QueryScope,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.agent.conversations(scope),
    exact: true,
    refetchType: "none",
  });
}

export function invalidateAgentExecutionDependencies(
  queryClient: QueryClient,
  scope: QueryScope,
) {
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.all(scope),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.jobs.all(scope),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all(scope),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.activity.all(scope),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all(scope),
      refetchType: "none",
    }),
  ]);
}

export function useCreateAgentConversationMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (accessToken) => createConversationRequest(accessToken),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.agent.conversations(scope),
        exact: true,
      });
    },
    onSuccess: (created) => {
      const detail: ConversationDetail = {
        id: created.id,
        messages: [],
        createdAt: created.createdAt,
        updatedAt: created.createdAt,
      };
      queryClient.setQueryData(
        queryKeys.agent.conversation(scope, created.id),
        detail,
      );
      updateAgentConversationSummaryCache(queryClient, scope, {
        id: created.id,
        preview: "",
        createdAt: created.createdAt,
        updatedAt: created.createdAt,
      });
    },
  });
}

type ConfirmAgentProposalVariables = {
  conversationId: string;
  proposalId: string;
};

export function useConfirmAgentProposalMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      { conversationId, proposalId }: ConfirmAgentProposalVariables,
    ) => confirmProposalRequest(accessToken, conversationId, proposalId),
    onSuccess: async (_, { conversationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agent.conversation(scope, conversationId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agent.conversations(scope),
          exact: true,
        }),
      ]);
      invalidateAgentExecutionDependencies(queryClient, scope);
    },
  });
}

type UpdateAgentProposalVariables = {
  conversationId: string;
  proposalId: string;
  input: UpdateProposalReviewInput;
};

export function useUpdateAgentProposalMutation() {
  const queryClient = useQueryClient();
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedMutation({
    mutationFn: (
      accessToken,
      { conversationId, proposalId, input }: UpdateAgentProposalVariables,
    ) =>
      updateProposalReviewRequest(
        accessToken,
        conversationId,
        proposalId,
        input,
      ),
    onSuccess: (proposal, { conversationId }) => {
      updateAgentConversationProposalCache(
        queryClient,
        scope,
        conversationId,
        proposal,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agent.conversations(scope),
        exact: true,
        refetchType: "none",
      });
    },
  });
}
