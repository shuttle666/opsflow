import { checkScheduleConflictsTool } from "./definitions/check-schedule-conflicts.tool";
import { getActivityFeedTool } from "./definitions/get-activity-feed.tool";
import { getCustomerTool } from "./definitions/get-customer.tool";
import { getJobTool } from "./definitions/get-job.tool";
import { searchCustomersTool } from "./definitions/search-customers.tool";
import { searchJobsTool } from "./definitions/search-jobs.tool";
import { searchStaffTool } from "./definitions/search-staff.tool";
import { proposalTools } from "./definitions/proposal-tools";
import { recordToolInvocationSafe } from "./tool-invocation-audit";
import { OpsFlowToolRegistry } from "./tool-registry";

export const opsFlowToolRegistry = new OpsFlowToolRegistry({
  ...(process.env.NODE_ENV === "test"
    ? {}
    : { recordInvocation: recordToolInvocationSafe }),
});

[
  searchJobsTool,
  getJobTool,
  searchCustomersTool,
  getCustomerTool,
  searchStaffTool,
  checkScheduleConflictsTool,
  getActivityFeedTool,
  ...proposalTools,
].forEach((tool) => opsFlowToolRegistry.register(tool));

export * from "./tool-registry";
export * from "./tool-invocation-audit";
export * from "./tool-types";
