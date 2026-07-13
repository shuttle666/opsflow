import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnyOpsFlowTool } from "../../operations-tools";

export function toAnthropicTool(tool: AnyOpsFlowTool): Anthropic.Tool {
  const inputSchema = z.toJSONSchema(tool.inputSchema, {
    target: "draft-07",
  });

  if (inputSchema.type !== "object") {
    throw new Error(`Tool input schema must be an object: ${tool.name}`);
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: inputSchema as Anthropic.Tool.InputSchema,
  };
}
