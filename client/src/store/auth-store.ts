import { create } from "zustand";
import type { AuthCredentials, AuthStatus, AuthUser } from "@/types/auth";

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: "unauthenticated",
  user: null,
  login: async (credentials) => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    set({
      status: "authenticated",
      user: {
        id: "placeholder-user",
        name: "Ops Manager",
        email: credentials.email,
        role: "admin",
      },
    });
  },
  logout: () => {
    set({
      status: "unauthenticated",
      user: null,
    });
  },
}));
