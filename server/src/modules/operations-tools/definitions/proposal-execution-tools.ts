import { MembershipRole } from "@prisma/client";
import {
  executeProposal,
  getProposalApprovalPolicy,
  getProposalApprovalUrl,
  getProposalForExecution,
} from "../../agent/agent.service";
import {
  executeProposalInputSchema,
  executeProposalOutputSchema,
  getProposalInputSchema,
  getProposalOutputSchema,
  type ExecuteProposalInput,
  type GetProposalInput,
} from "../proposal-execution-contracts";
import type { AnyOpsFlowTool, ToolExecutionContext } from "../tool-types";

const managerRoles = [MembershipRole.OWNER, MembershipRole.MANAGER];

async function getProposal(
  auth: Parameters<typeof getProposalForExecution>[0],
  input: GetProposalInput,
) {
  const snapshot = await getProposalForExecution(auth, input.proposalId);

  return {
    ...snapshot,
    ...getProposalApprovalPolicy(snapshot.proposal),
    approvalUrl: getProposalApprovalUrl(
      snapshot.conversationId,
      snapshot.proposalId,
    ),
  };
}

async function executeConfirmedProposal(
  auth: Parameters<typeof executeProposal>[0],
  input: ExecuteProposalInput,
  context: ToolExecutionContext,
) {
  return executeProposal(auth, input.proposalId, {
    source: context.source,
    confirmationText: input.confirmationText,
    appendReceiptMessage: false,
  });
}

export const proposalExecutionTools: AnyOpsFlowTool[] = [
  {
    name: "get_proposal",
    title: "Get a proposal",
    description:
      "Read the latest stored state, approval mode, Web fallback URL, and any execution result for an OpsFlow proposal.",
    audiences: ["web-agent", "external-mcp"],
    allowedRoles: managerRoles,
    inputSchema: getProposalInputSchema,
    outputSchema: getProposalOutputSchema,
    annotations: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    conversationContext: "none",
    execute: getProposal,
  },
  {
    name: "execute_proposal",
    title: "Execute a confirmed proposal",
    description:
      "Execute an eligible OpsFlow proposal only after displaying it and receiving explicit confirmation in a new user message after proposal creation. Pass the user's latest confirmation message verbatim as confirmationText. Never treat the original business request as confirmation, never call this in the same user turn as propose_*, and never call propose_* and execute_proposal consecutively in one turn.",
    audiences: ["web-agent", "external-mcp"],
    allowedRoles: managerRoles,
    inputSchema: executeProposalInputSchema,
    outputSchema: executeProposalOutputSchema,
    annotations: {
      readOnly: false,
      destructive: true,
      idempotent: true,
      openWorld: false,
    },
    conversationContext: "none",
    execute: executeConfirmedProposal,
  },
];
