import { AgentProposalStatus, JobStatus } from "@prisma/client";
import { z } from "zod";
import { proposalSchema } from "./proposal-contracts";

const agentProposalTypeSchema = z.enum([
  "CREATE_CUSTOMER",
  "UPDATE_CUSTOMER",
  "CREATE_JOB",
  "UPDATE_JOB",
  "ASSIGN_JOB",
  "SCHEDULE_JOB",
  "CHANGE_JOB_STATUS",
  "CANCEL_JOB",
]);

export const proposalApprovalModeSchema = z.enum([
  "CONVERSATIONAL_OR_WEB",
  "WEB_ONLY",
]);

export const confirmedProposalResultSchema = z.object({
  proposalId: z.string(),
  proposalType: agentProposalTypeSchema.optional(),
  entityType: z.enum(["customer", "job"]),
  createdCustomerId: z.string().optional(),
  createdCustomerName: z.string().optional(),
  updatedCustomerId: z.string().optional(),
  updatedCustomerName: z.string().optional(),
  usedExistingCustomer: z.boolean().optional(),
  createdJobId: z.string().optional(),
  createdJobTitle: z.string().optional(),
  updatedExistingJob: z.boolean().optional(),
  assignedToName: z.string().optional(),
  transitionedTo: z.nativeEnum(JobStatus).optional(),
});

export const getProposalInputSchema = z
  .object({ proposalId: z.uuid() })
  .strict();

export const getProposalOutputSchema = z.object({
  proposalId: z.uuid(),
  conversationId: z.uuid(),
  status: z.nativeEnum(AgentProposalStatus),
  approvalMode: proposalApprovalModeSchema,
  approvalUrl: z.string().url(),
  proposal: proposalSchema,
  confirmationResult: confirmedProposalResultSchema.optional(),
});

export const executeProposalInputSchema = z
  .object({
    proposalId: z.uuid(),
    confirmationText: z
      .string()
      .min(1)
      .max(5000)
      .refine((value) => value.trim().length > 0, {
        message: "Confirmation text cannot be blank.",
      }),
  })
  .strict();

export const executeProposalOutputSchema = z.object({
  executed: z.literal(true),
  proposalId: z.uuid(),
  conversationId: z.uuid(),
  status: z.literal("CONFIRMED"),
  result: confirmedProposalResultSchema,
});

export type GetProposalInput = z.infer<typeof getProposalInputSchema>;
export type ExecuteProposalInput = z.infer<typeof executeProposalInputSchema>;
