import { checkScheduleConflictsTool } from "./definitions/check-schedule-conflicts.tool";
import { getActivityFeedTool } from "./definitions/get-activity-feed.tool";
import { getCustomerTool } from "./definitions/get-customer.tool";
import { getJobTool } from "./definitions/get-job.tool";
import { searchCustomersTool } from "./definitions/search-customers.tool";
import { searchJobsTool } from "./definitions/search-jobs.tool";
import { searchStaffTool } from "./definitions/search-staff.tool";
import { proposalTools } from "./definitions/proposal-tools";
import { OpsFlowToolRegistry } from "./tool-registry";

export const opsFlowToolRegistry = new OpsFlowToolRegistry();

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
export * from "./tool-types";
