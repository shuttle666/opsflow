import { searchJobsTool } from "./definitions/search-jobs.tool";
import { OpsFlowToolRegistry } from "./tool-registry";

export const opsFlowToolRegistry = new OpsFlowToolRegistry();

opsFlowToolRegistry.register(searchJobsTool);

export * from "./tool-registry";
export * from "./tool-types";
