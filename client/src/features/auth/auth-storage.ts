import type { AuthTokens } from "@/types/auth";

const ACCESS_TOKEN_KEY = "opsflow.accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "opsflow.refreshToken";

function isBrowser() {
  return typeof window !== "undefined";
}

export function readStoredTokens(): AuthTokens | null {
  if (!isBrowser()) {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);

  if (!accessToken) {
    return null;
  }

  return { accessToken };
}

export function writeStoredTokens(tokens: AuthTokens) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

export function clearStoredTokens() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}
