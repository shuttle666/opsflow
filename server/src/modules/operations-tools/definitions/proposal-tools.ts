import { MembershipRole } from "@prisma/client";
import type { AnyOpsFlowTool } from "../tool-types";
import {
  cancelJobProposalInputSchema,
  changeJobStatusProposalInputSchema,
  createCustomerProposalInputSchema,
  createJobProposalInputSchema,
  dispatchJobProposalInputSchema,
  proposalToolOutputSchema,
  updateCustomerProposalInputSchema,
  updateJobProposalInputSchema,
} from "../proposal-contracts";
import {
  proposeCancelJob,
  proposeChangeJobStatus,
  proposeCreateCustomer,
  proposeCreateJob,
  proposeDispatchJob,
  proposeUpdateCustomer,
  proposeUpdateJob,
} from "../proposal-builder";

const managerRoles = [MembershipRole.OWNER, MembershipRole.MANAGER];
const proposalAnnotations = {
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: false,
};

export const proposalTools: AnyOpsFlowTool[] = [
  {
    name: "propose_create_customer",
    title: "Propose creating a customer",
    description:
      "Create a pending proposal for a manager to review before a new customer is created.",
    audiences: ["web-agent"],
    allowedRoles: managerRoles,
    inputSchema: createCustomerProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeCreateCustomer,
  },
  {
    name: "propose_update_customer",
    title: "Propose updating a customer",
    description:
      "Create a pending proposal to update selected customer profile fields. Resolve the customer ID first.",
    audiences: ["web-agent"],
    allowedRoles: managerRoles,
    inputSchema: updateCustomerProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeUpdateCustomer,
  },
  {
    name: "propose_create_job",
    title: "Propose creating a job",
    description:
      "Create one pending proposal for a new job, optionally with a new customer, assignee, and schedule. Display the returned proposal and wait for a later user confirmation before using execute_proposal; the Web approval URL remains available as a fallback.",
    audiences: ["web-agent", "external-mcp"],
    allowedRoles: managerRoles,
    inputSchema: createJobProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeCreateJob,
  },
  {
    name: "propose_update_job",
    title: "Propose updating a job",
    description:
      "Create a pending proposal to update an existing job's title, service address, or description.",
    audiences: ["web-agent"],
    allowedRoles: managerRoles,
    inputSchema: updateJobProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeUpdateJob,
  },
  {
    name: "propose_dispatch_job",
    title: "Propose dispatching a job",
    description:
      "Create one pending proposal to assign and/or schedule an existing job. Resolve job and staff IDs first, display the returned proposal, and wait for a later user confirmation before using execute_proposal; the Web approval URL remains available as a fallback.",
    audiences: ["web-agent", "external-mcp"],
    allowedRoles: managerRoles,
    inputSchema: dispatchJobProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeDispatchJob,
  },
  {
    name: "propose_change_job_status",
    title: "Propose changing job status",
    description:
      "Create a pending proposal for a manager-confirmed job status transition other than cancellation.",
    audiences: ["web-agent"],
    allowedRoles: managerRoles,
    inputSchema: changeJobStatusProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeChangeJobStatus,
  },
  {
    name: "propose_cancel_job",
    title: "Propose cancelling a job",
    description:
      "Create a pending cancellation proposal with a required reason. This does not cancel the job until confirmed.",
    audiences: ["web-agent"],
    allowedRoles: managerRoles,
    inputSchema: cancelJobProposalInputSchema,
    outputSchema: proposalToolOutputSchema,
    annotations: proposalAnnotations,
    conversationContext: "required",
    execute: proposeCancelJob,
  },
];
