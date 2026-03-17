export type AuthStatus = "authenticated" | "unauthenticated";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "dispatcher" | "staff";
};

export type AuthCredentials = {
  email: string;
  password: string;
};
