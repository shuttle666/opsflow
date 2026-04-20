import { beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeStore } from "@/store/theme-store";

describe("theme store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.setState({ mode: "light", scheme: "violet" });
  });

  it("cycles between light, dark, and system modes and persists the selection", () => {
    useThemeStore.getState().cycleMode();

    expect(useThemeStore.getState().mode).toBe("dark");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"mode":"dark"');

    useThemeStore.getState().cycleMode();

    expect(useThemeStore.getState().mode).toBe("system");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"mode":"system"');

    useThemeStore.getState().cycleMode();

    expect(useThemeStore.getState().mode).toBe("light");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"mode":"light"');
  });

  it("stores explicit mode and scheme values", () => {
    useThemeStore.getState().setMode("system");
    useThemeStore.getState().setScheme("ember");

    expect(useThemeStore.getState().mode).toBe("system");
    expect(useThemeStore.getState().scheme).toBe("ember");
    expect(window.localStorage.getItem("opsflow-theme")).toBe(
      JSON.stringify({ mode: "system", scheme: "ember", version: 2 }),
    );
  });

  it("stores each Claude V2 color scheme", () => {
    useThemeStore.getState().setScheme("violet");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"scheme":"violet"');

    useThemeStore.getState().setScheme("ocean");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"scheme":"ocean"');

    useThemeStore.getState().setScheme("ember");
    expect(window.localStorage.getItem("opsflow-theme")).toContain('"scheme":"ember"');
  });

  it("migrates old single-scheme ocean storage to violet", async () => {
    window.localStorage.setItem(
      "opsflow-theme",
      JSON.stringify({ mode: "dark", scheme: "ocean" }),
    );

    vi.resetModules();
    const { useThemeStore: freshStore } = await import("@/store/theme-store");

    expect(freshStore.getState().mode).toBe("dark");
    expect(freshStore.getState().scheme).toBe("violet");
  });

  it("keeps newly stored ocean selections", async () => {
    window.localStorage.setItem(
      "opsflow-theme",
      JSON.stringify({ mode: "dark", scheme: "ocean", version: 2 }),
    );

    vi.resetModules();
    const { useThemeStore: freshStore } = await import("@/store/theme-store");

    expect(freshStore.getState().mode).toBe("dark");
    expect(freshStore.getState().scheme).toBe("ocean");
  });

  it("falls back to violet for invalid stored schemes", async () => {
    window.localStorage.setItem(
      "opsflow-theme",
      JSON.stringify({ mode: "light", scheme: "unknown", version: 2 }),
    );

    vi.resetModules();
    const { useThemeStore: freshStore } = await import("@/store/theme-store");

    expect(freshStore.getState().mode).toBe("light");
    expect(freshStore.getState().scheme).toBe("violet");
  });
});
