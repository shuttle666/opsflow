import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/store/theme-store";

describe("theme store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.setState({ mode: "light", scheme: "ocean" });
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
    useThemeStore.getState().setScheme("ocean");

    expect(useThemeStore.getState().mode).toBe("system");
    expect(useThemeStore.getState().scheme).toBe("ocean");
    expect(window.localStorage.getItem("opsflow-theme")).toBe(
      JSON.stringify({ mode: "system", scheme: "ocean" }),
    );
  });
});
