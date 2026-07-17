import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQueryScope } from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";
import type { InvitationCreateInput, InvitationStatus } from "@/types/auth";

export function useMyInvitationsQuery() {
  const scope = useAuthenticatedQueryScope();
  const status = useAuthStore((state) => state.status);
  const listMyInvitations = useAuthStore((state) => state.listMyInvitations);

  return useQuery({
    queryKey: queryKeys.invitations.mine(scope),
    queryFn: listMyInvitations,
    enabled: status === "authenticated" && Boolean(scope.userId),
  });
}

export function useTenantInvitationsQuery(
  statusFilter?: InvitationStatus,
  enabled = true,
) {
  const scope = useAuthenticatedQueryScope();
  const authStatus = useAuthStore((state) => state.status);
  const listTenantInvitations = useAuthStore(
    (state) => state.listTenantInvitations,
  );

  return useQuery({
    queryKey: queryKeys.invitations.tenantList(scope, statusFilter),
    queryFn: () => listTenantInvitations(statusFilter),
    enabled:
      enabled && authStatus === "authenticated" && Boolean(scope.tenantId),
  });
}

export function useCreateInvitationMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();
  const createInvitation = useAuthStore((state) => state.createInvitation);

  return useMutation({
    mutationFn: (input: InvitationCreateInput) => createInvitation(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.tenantLists(scope),
      }),
  });
}

export function useResendInvitationMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();
  const resendInvitation = useAuthStore((state) => state.resendInvitation);

  return useMutation({
    mutationFn: (invitationId: string) => resendInvitation(invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.tenantLists(scope),
      }),
  });
}

export function useCancelInvitationMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();
  const cancelInvitation = useAuthStore((state) => state.cancelInvitation);

  return useMutation({
    mutationFn: (invitationId: string) => cancelInvitation(invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.tenantLists(scope),
      }),
  });
}

export function useAcceptInvitationByIdMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();
  const acceptInvitationById = useAuthStore(
    (state) => state.acceptInvitationById,
  );

  return useMutation({
    mutationFn: (invitationId: string) => acceptInvitationById(invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.mine(scope),
      }),
  });
}

export function useAcceptInvitationTokenMutation() {
  const acceptInvitation = useAuthStore((state) => state.acceptInvitation);

  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
  });
}
