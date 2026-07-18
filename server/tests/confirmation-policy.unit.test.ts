import {
  isExplicitConfirmationText,
  normalizeExplicitConfirmationText,
} from "../src/modules/agent/confirmation-policy";

describe("conversational confirmation policy", () => {
  it.each([
    [" OK ", "ok"],
    ["ＯＫ！", "ok"],
    ["CONFIRM.", "confirm"],
    ["Go   ahead!", "go ahead"],
    [" 确认。 ", "确认"],
    ["可以了！", "可以了"],
  ])("normalizes %j without changing its intent", (input, expected) => {
    expect(normalizeExplicitConfirmationText(input)).toBe(expected);
  });

  it.each([
    "OK",
    "Okay!",
    "Confirm",
    "Confirm it.",
    "OK, execute it!",
    "Execute it",
    "Proceed!",
    "Go ahead",
    "确认",
    "确认执行。",
    "执行",
    "可以了！",
    "就这样执行",
    "按此执行",
    "继续执行",
  ])("accepts the explicit phrase %j", (input) => {
    expect(isExplicitConfirmationText(input)).toBe(true);
  });

  it.each([
    "",
    "Do not execute",
    "Don't execute it",
    "不要执行",
    "先别执行",
    "yes",
    "Confirm?",
    "确认吗？",
    "Can you move it to the afternoon?",
    "可以改到下午吗",
    "OK, but change the assignee first",
    "Create a leaking tap job for Noah tomorrow morning.",
    "I have reviewed the complete proposal and would now like you to execute it exactly as described above.",
  ])("rejects the non-explicit phrase %j", (input) => {
    expect(isExplicitConfirmationText(input)).toBe(false);
  });
});
