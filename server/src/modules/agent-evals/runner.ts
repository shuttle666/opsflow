import { env } from "../../config/env";
import { agentEvalCases } from "./cases";
import {
  cleanupEvalTenants,
  cleanupEvalWorkspace,
  createEvalWorkspace,
} from "./workspace";
import {
  fail,
  resultFromAssertions,
  type AiEvalMode,
  type AiEvalResult,
  type AiEvalSummary,
} from "./types";

async function runCase(
  mode: AiEvalMode,
  evalCase: (typeof agentEvalCases)[number],
): Promise<AiEvalResult> {
  const workspace = await createEvalWorkspace(evalCase.name);

  try {
    if (mode === "llm") {
      if (!evalCase.runLlm) {
        return resultFromAssertions({
          name: evalCase.name,
          prompt: evalCase.prompt,
          mode,
          assertions: [fail("LLM eval case is implemented")],
        });
      }

      return await evalCase.runLlm(workspace);
    }

    return await evalCase.runCheap(workspace);
  } catch (error) {
    return resultFromAssertions({
      name: evalCase.name,
      prompt: evalCase.prompt,
      mode,
      assertions: [
        fail("eval case completed without throwing", {
          actual: error instanceof Error ? error.message : String(error),
        }),
      ],
    });
  } finally {
    await cleanupEvalWorkspace(workspace).catch((error) => {
      console.error("Failed to clean AI eval workspace", error);
    });
  }
}

export async function runAgentEvals(mode: AiEvalMode): Promise<AiEvalSummary> {
  const startedAt = Date.now();

  if (mode === "llm") {
    if (process.env.RUN_LLM_EVALS !== "true") {
      throw new Error("LLM evals require RUN_LLM_EVALS=true.");
    }

    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("LLM evals require ANTHROPIC_API_KEY.");
    }
  }

  await cleanupEvalTenants();

  const runnableCases =
    mode === "llm"
      ? agentEvalCases.filter((evalCase) => Boolean(evalCase.runLlm))
      : agentEvalCases;
  const results: AiEvalResult[] = [];

  for (const evalCase of runnableCases) {
    results.push(await runCase(mode, evalCase));
  }

  const failed = results.filter((result) => !result.passed).length;

  return {
    mode,
    passed: failed === 0,
    total: results.length,
    failed,
    durationMs: Date.now() - startedAt,
    results,
  };
}

export function formatAiEvalSummary(summary: AiEvalSummary) {
  const lines = [
    `AI eval ${summary.mode}: ${summary.passed ? "passed" : "failed"} (${summary.total - summary.failed}/${summary.total}) in ${summary.durationMs}ms`,
  ];

  for (const result of summary.results) {
    lines.push(`${result.passed ? "✓" : "✗"} ${result.name}`);

    if (!result.passed) {
      for (const assertion of result.assertions.filter((item) => !item.passed)) {
        lines.push(`  - ${assertion.name}`);
        if (assertion.expected !== undefined) {
          lines.push(`    expected: ${JSON.stringify(assertion.expected)}`);
        }
        if (assertion.actual !== undefined) {
          lines.push(`    actual: ${JSON.stringify(assertion.actual)}`);
        }
        if (assertion.details !== undefined) {
          lines.push(`    details: ${JSON.stringify(assertion.details)}`);
        }
      }
    }
  }

  return lines.join("\n");
}
