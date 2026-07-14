import { JobStatus } from "@prisma/client";
import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import {
  saveTypedProposalToolInputSchema,
  type SaveTypedProposalToolInput,
} from "../agent/agent-schemas";
import {
  getProposalApprovalPolicy,
  getProposalApprovalUrl,
  storeTypedProposal,
  type DispatchProposal,
} from "../agent/agent.service";
import { resolveTimeWindow } from "../agent/target-resolvers";
import * as customerService from "../customer/customer.service";
import * as jobService from "../job/job.service";
import * as membershipService from "../membership/membership.service";
import type {
  CancelJobProposalInput,
  ChangeJobStatusProposalInput,
  CreateCustomerProposalInput,
  CreateJobProposalInput,
  DispatchJobProposalInput,
  LocalScheduleInput,
  UpdateCustomerProposalInput,
  UpdateJobProposalInput,
} from "./proposal-contracts";
import type { ToolExecutionContext } from "./tool-types";

function requireConversationId(context: ToolExecutionContext) {
  if (!context.conversationId) {
    throw new ApiError(
      400,
      "Conversation context is required to create a proposal.",
      "TOOL_CONVERSATION_REQUIRED",
    );
  }

  return context.conversationId;
}

function buildScheduleDraft(schedule: LocalScheduleInput | undefined) {
  if (!schedule) {
    return undefined;
  }

  const resolved = resolveTimeWindow(schedule);
  if (resolved.status !== "matched") {
    throw new ApiError(
      400,
      resolved.reason,
      "TOOL_SCHEDULE_INVALID",
    );
  }

  return {
    localDate: resolved.localDate,
    localEndDate: resolved.localEndDate,
    localStartTime: resolved.localStartTime,
    localEndTime: resolved.localEndTime,
    scheduledStartAt: resolved.scheduledStartAt,
    scheduledEndAt: resolved.scheduledEndAt,
    timezone: resolved.timezone,
  };
}

async function matchedCustomer(auth: AuthContext, customerId: string) {
  const customer = await customerService.getCustomerDetail(auth, customerId);

  return {
    status: "matched" as const,
    matchedCustomerId: customer.id,
    name: customer.name,
    phone: customer.phone ?? undefined,
    email: customer.email ?? undefined,
    notes: customer.notes ?? undefined,
    matches: [{ id: customer.id, name: customer.name }],
  };
}

function newCustomer(input: CreateCustomerProposalInput) {
  return {
    status: "new" as const,
    name: input.name,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
  };
}

async function matchedAssignee(
  auth: AuthContext,
  membershipId: string | undefined,
) {
  if (!membershipId) {
    return undefined;
  }

  const staff = await membershipService.getAssignableStaffMembership(
    auth,
    membershipId,
  );

  return {
    status: "matched" as const,
    membershipId: staff.membershipId,
    userId: staff.userId,
    displayName: staff.displayName,
    matches: [staff],
  };
}

async function existingJobProposalBase(auth: AuthContext, jobId: string) {
  const job = await jobService.getJobDetail(auth, jobId);

  return {
    job,
    target: {
      customerId: job.customer.id,
      jobId: job.id,
    },
    customer: {
      status: "matched" as const,
      matchedCustomerId: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone ?? undefined,
      email: job.customer.email ?? undefined,
      matches: [{ id: job.customer.id, name: job.customer.name }],
    },
  };
}

async function saveCanonicalProposal(
  auth: AuthContext,
  context: ToolExecutionContext,
  input: SaveTypedProposalToolInput,
) {
  const conversationId = requireConversationId(context);
  const validated = saveTypedProposalToolInputSchema.parse(input);
  const proposal = await storeTypedProposal(auth, conversationId, validated);

  return proposalResult(proposal);
}

function proposalResult(proposal: DispatchProposal) {
  const approvalPolicy = getProposalApprovalPolicy(proposal);

  return {
    saved: true as const,
    proposalId: proposal.id,
    reviewStatus: proposal.review?.status ?? "READY",
    approvalRequired: true as const,
    approvalUrl: getProposalApprovalUrl(proposal.conversationId, proposal.id),
    ...approvalPolicy,
    blockers: proposal.review?.blockers ?? [],
    warnings: proposal.review?.warnings ?? proposal.warnings,
    proposal,
  };
}

export async function proposeCreateCustomer(
  auth: AuthContext,
  input: CreateCustomerProposalInput,
  context: ToolExecutionContext,
) {
  return saveCanonicalProposal(auth, context, {
    type: "CREATE_CUSTOMER",
    customer: newCustomer(input),
    warnings: [],
    confidence: 1,
  });
}

export async function proposeUpdateCustomer(
  auth: AuthContext,
  input: UpdateCustomerProposalInput,
  context: ToolExecutionContext,
) {
  const customer = await customerService.getCustomerDetail(auth, input.customerId);
  const fields = ["name", "phone", "email", "notes"] as const;
  const changes = fields.flatMap((field) => {
    const nextValue = input.changes[field];
    if (nextValue === undefined) {
      return [];
    }

    return [{ field, from: customer[field], to: nextValue }];
  });

  return saveCanonicalProposal(auth, context, {
    type: "UPDATE_CUSTOMER",
    target: { customerId: customer.id },
    customer: await matchedCustomer(auth, customer.id),
    changes,
    warnings: [],
    confidence: 1,
  });
}

export async function proposeCreateJob(
  auth: AuthContext,
  input: CreateJobProposalInput,
  context: ToolExecutionContext,
) {
  const customer =
    input.customer.kind === "existing"
      ? await matchedCustomer(auth, input.customer.customerId)
      : newCustomer(input.customer);
  const target =
    input.customer.kind === "existing"
      ? { customerId: input.customer.customerId }
      : undefined;

  return saveCanonicalProposal(auth, context, {
    type: "CREATE_JOB",
    ...(target ? { target } : {}),
    customer,
    jobDraft: {
      title: input.title,
      serviceAddress: input.serviceAddress,
      description: input.description,
    },
    scheduleDraft: buildScheduleDraft(input.schedule),
    assigneeDraft: await matchedAssignee(auth, input.assigneeMembershipId),
    warnings: [],
    confidence: 1,
  });
}

export async function proposeUpdateJob(
  auth: AuthContext,
  input: UpdateJobProposalInput,
  context: ToolExecutionContext,
) {
  const base = await existingJobProposalBase(auth, input.jobId);

  return saveCanonicalProposal(auth, context, {
    type: "UPDATE_JOB",
    target: base.target,
    customer: base.customer,
    jobDraft: {
      existingJobId: base.job.id,
      title: input.changes.title ?? base.job.title,
      serviceAddress:
        input.changes.serviceAddress ?? base.job.serviceAddress,
      description:
        input.changes.description === undefined
          ? base.job.description ?? undefined
          : input.changes.description ?? undefined,
    },
    warnings: [],
    confidence: 1,
  });
}

export async function proposeDispatchJob(
  auth: AuthContext,
  input: DispatchJobProposalInput,
  context: ToolExecutionContext,
) {
  const base = await existingJobProposalBase(auth, input.jobId);

  return saveCanonicalProposal(auth, context, {
    type: input.schedule ? "SCHEDULE_JOB" : "ASSIGN_JOB",
    target: base.target,
    customer: base.customer,
    jobDraft: {
      existingJobId: base.job.id,
      title: base.job.title,
      description: undefined,
    },
    scheduleDraft: buildScheduleDraft(input.schedule),
    assigneeDraft: await matchedAssignee(auth, input.assigneeMembershipId),
    warnings: [],
    confidence: 1,
  });
}

export async function proposeChangeJobStatus(
  auth: AuthContext,
  input: ChangeJobStatusProposalInput,
  context: ToolExecutionContext,
) {
  const base = await existingJobProposalBase(auth, input.jobId);

  return saveCanonicalProposal(auth, context, {
    type: "CHANGE_JOB_STATUS",
    target: base.target,
    customer: base.customer,
    jobDraft: {
      existingJobId: base.job.id,
      title: base.job.title,
      description: undefined,
    },
    statusDraft: { toStatus: input.toStatus, reason: input.reason },
    warnings: [],
    confidence: 1,
  });
}

export async function proposeCancelJob(
  auth: AuthContext,
  input: CancelJobProposalInput,
  context: ToolExecutionContext,
) {
  const base = await existingJobProposalBase(auth, input.jobId);

  return saveCanonicalProposal(auth, context, {
    type: "CANCEL_JOB",
    target: base.target,
    customer: base.customer,
    jobDraft: {
      existingJobId: base.job.id,
      title: base.job.title,
      description: undefined,
    },
    statusDraft: { toStatus: JobStatus.CANCELLED, reason: input.reason },
    warnings: [],
    confidence: 1,
  });
}
