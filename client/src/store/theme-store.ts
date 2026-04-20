import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeScheme = "violet" | "ocean" | "ember";

type ThemeStore = {
  mode: ThemeMode;
  scheme: ThemeScheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
  setScheme: (scheme: ThemeScheme) => void;
};

const THEME_STORAGE_KEY = "opsflow-theme";
const THEME_STORAGE_VERSION = 2;

type StoredTheme = {
  mode?: ThemeMode;
  scheme?: ThemeScheme;
  version?: number;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isThemeScheme(value: unknown): value is ThemeScheme {
  return value === "violet" || value === "ocean" || value === "ember";
}

function readStoredTheme(): Pick<ThemeStore, "mode" | "scheme"> {
  if (typeof window === "undefined") {
    return { mode: "system", scheme: "violet" };
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredTheme) : {};

    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : "system",
      scheme: isThemeScheme(parsed.scheme)
        ? parsed.version === THEME_STORAGE_VERSION
          ? parsed.scheme
          : "violet"
        : "violet",
    };
  } catch {
    return { mode: "system", scheme: "violet" };
  }
}

function writeStoredTheme(theme: Pick<ThemeStore, "mode" | "scheme">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    THEME_STORAGE_KEY,
    JSON.stringify({ ...theme, version: THEME_STORAGE_VERSION }),
  );
}

const initialTheme = readStoredTheme();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: initialTheme.mode,
  scheme: initialTheme.scheme,
  setMode: (mode) => {
    set({ mode });
    writeStoredTheme({ mode, scheme: get().scheme });
  },
  cycleMode: () => {
    const current = get().mode;
    const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
    set({ mode: next });
    writeStoredTheme({ mode: next, scheme: get().scheme });
  },
  setScheme: (scheme) => {
    set({ scheme });
    writeStoredTheme({ mode: get().mode, scheme });
  },
}));
