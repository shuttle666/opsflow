import { describe, expect, it } from "vitest";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";

describe("shared button styles", () => {
  it.each([
    ["primary", primaryButtonClassName],
    ["secondary", secondaryButtonClassName],
    ["subtle", subtleButtonClassName],
    ["danger", dangerButtonClassName],
  ])("keeps the %s variant on the standard responsive control height", (_, className) => {
    expect(className).toContain("min-h-11");
    expect(className).toContain("md:min-h-9");
  });
});
