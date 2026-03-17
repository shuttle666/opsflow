import { useAuthStore } from "@/store/auth-store";

export function useAuth() {
  return useAuthStore((state) => ({
    status: state.status,
    user: state.user,
    login: state.login,
    logout: state.logout,
  }));
}
