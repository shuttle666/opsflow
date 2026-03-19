import { useAuthStore } from "@/store/auth-store";

export function useAuth() {
  return useAuthStore((state) => ({
    status: state.status,
    user: state.user,
    currentTenant: state.currentTenant,
    availableTenants: state.availableTenants,
    bootstrapSession: state.bootstrapSession,
    register: state.register,
    login: state.login,
    logout: state.logout,
    switchTenant: state.switchTenant,
    createInvitation: state.createInvitation,
    acceptInvitation: state.acceptInvitation,
    clearSession: state.clearSession,
  }));
}
