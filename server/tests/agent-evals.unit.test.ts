import { describe, expect, it } from "vitest";
import { agentEvalCases } from "../src/modules/agent-evals/cases";
import { formatAiEvalSummary } from "../src/modules/agent-evals/runner";
import type { AiEvalSummary } from "../src/modules/agent-evals/types";

describe("agent eval definitions", () => {
  it("includes the core regression scenarios for cheap evals", () => {
    expect(agentEvalCases.map((evalCase) => evalCase.name)).toEqual(
      expect.arrayContaining([
        "existing dishwasher job schedule uses existing job",
        "create job requires service address",
        "update customer phone only changes customer profile",
        "ambiguous same-name customer stops before proposal",
        "missing staff cannot become matched assignee",
        "schedule conflict is surfaced before saving proposal",
        "regression kitchen tap assignment does not create translated duplicate",
      ]),
    );
  });

  it("formats failing eval summaries with assertion details", () => {
    const summary: AiEvalSummary = {
      mode: "cheap",
      passed: false,
      total: 1,
      failed: 1,
      durationMs: 12,
      results: [
        {
          name: "sample eval",
          prompt: "sample prompt",
          mode: "cheap",
          passed: false,
          assertions: [
            {
              name: "proposal type",
              passed: false,
              expected: "SCHEDULE_JOB",
              actual: "CREATE_JOB",
            },
          ],
        },
      ],
    };

    expect(formatAiEvalSummary(summary)).toContain("AI eval cheap: failed");
    expect(formatAiEvalSummary(summary)).toContain("proposal type");
    expect(formatAiEvalSummary(summary)).toContain("SCHEDULE_JOB");
  });
});
