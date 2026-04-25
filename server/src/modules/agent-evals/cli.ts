import { prisma } from "../../lib/prisma";
import { formatAiEvalSummary, runAgentEvals } from "./runner";
import type { AiEvalMode } from "./types";

function parseMode(value: string | undefined): AiEvalMode {
  if (!value || value === "cheap") {
    return "cheap";
  }

  if (value === "llm") {
    return "llm";
  }

  throw new Error(`Unknown AI eval mode: ${value}`);
}

async function main() {
  const mode = parseMode(process.argv[2]);
  const summary = await runAgentEvals(mode);

  console.log(formatAiEvalSummary(summary));
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
