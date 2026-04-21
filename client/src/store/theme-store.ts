import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeScheme = "violet" | "ocean" | "ember";

type ThemeStore = {
  mode: ThemeMode;
  scheme: ThemeScheme;
  hydrateTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
  setScheme: (scheme: ThemeScheme) => void;
};

const THEME_STORAGE_KEY = "opsflow-theme";
const THEME_STORAGE_VERSION = 2;
const DEFAULT_THEME: Pick<ThemeStore, "mode" | "scheme"> = {
  mode: "system",
  scheme: "violet",
};

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
    return DEFAULT_THEME;
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
    return DEFAULT_THEME;
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

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: DEFAULT_THEME.mode,
  scheme: DEFAULT_THEME.scheme,
  hydrateTheme: () => {
    set(readStoredTheme());
  },
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
