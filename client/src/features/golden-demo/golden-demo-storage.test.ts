import { beforeEach, describe, expect, it } from "vitest";
import {
  GOLDEN_DEMO_STORAGE_KEY,
  clearGoldenDemoProgress,
  readGoldenDemoProgress,
  writeGoldenDemoProgress,
  type GoldenDemoStatus,
} from "./golden-demo-storage";

describe("golden demo browser progress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.each<GoldenDemoStatus>(["seen", "dismissed", "started", "completed"])(
    "round-trips the %s status without storing workspace data",
    (status) => {
      const written = writeGoldenDemoProgress(status, 2);

      expect(readGoldenDemoProgress()).toEqual(written);
      expect(readGoldenDemoProgress()).toMatchObject({
        version: 1,
        status,
        currentStep: 2,
      });
      expect(window.localStorage.getItem(GOLDEN_DEMO_STORAGE_KEY)).not.toContain(
        "tenantId",
      );
    },
  );

  it("ignores malformed or incompatible state", () => {
    window.localStorage.setItem(GOLDEN_DEMO_STORAGE_KEY, "not-json");
    expect(readGoldenDemoProgress()).toBeNull();

    window.localStorage.setItem(
      GOLDEN_DEMO_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        status: "started",
        updatedAt: new Date().toISOString(),
      }),
    );
    expect(readGoldenDemoProgress()).toBeNull();
  });

  it("clears saved UI progress", () => {
    writeGoldenDemoProgress("dismissed");

    clearGoldenDemoProgress();

    expect(readGoldenDemoProgress()).toBeNull();
  });
});
