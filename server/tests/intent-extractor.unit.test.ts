import type { AiIntentExtraction } from "../src/modules/agent/intent-extractor";
import { mergeAgentIntentClassification } from "../src/modules/agent/intent-extractor";
import { classifyAgentIntent } from "../src/modules/agent/intent-router";

describe("intent extractor merge", () => {
  it("preserves deterministic phone and email fields when AI adds cleaner queries", () => {
    const ruleResult = classifyAgentIntent(
      "帮我把 John 的 phone 改成 0412 345 678, email 改成 john@example.com",
    );
    const aiResult: AiIntentExtraction = {
      intent: "UPDATE_CUSTOMER",
      confidence: 0.92,
      customerQuery: "John",
      customerFields: {
        phone: "wrong",
        email: "wrong@example.com",
      },
    };

    const merged = mergeAgentIntentClassification(ruleResult, aiResult);

    expect(merged.intent).toBe("UPDATE_CUSTOMER");
    expect(merged.source).toBe("merged");
    expect(merged.extracted.customerQuery).toBe("John");
    expect(merged.extracted.customerFields).toEqual({
      phone: "0412 345 678",
      email: "john@example.com",
    });
  });

  it("does not let low-confidence AI intent override the rule intent", () => {
    const ruleResult = classifyAgentIntent("取消 John 那个 kitchen tap leaking 的 job");
    const aiResult: AiIntentExtraction = {
      intent: "UPDATE_JOB",
      confidence: 0.4,
      jobQuery: "kitchen tap leaking",
      jobConcepts: ["tap", "leak"],
    };

    const merged = mergeAgentIntentClassification(ruleResult, aiResult);

    expect(merged.intent).toBe("CANCEL_JOB");
    expect(merged.extracted.jobQuery).toBe("kitchen tap leaking");
    expect(merged.extracted.jobConcepts).toEqual(["leak", "tap", "kitchen"]);
  });
});
