import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import * as auditService from "../audit/audit.service";
import * as customerService from "../customer/customer.service";
import * as jobService from "../job/job.service";
import * as membershipService from "../membership/membership.service";
import {
  checkScheduleConflictsToolInputSchema,
  getCustomerDetailToolInputSchema,
  getJobDetailToolInputSchema,
  listActivityFeedToolInputSchema,
  listCustomersToolInputSchema,
  listJobsToolInputSchema,
  listMembershipsToolInputSchema,
  saveDispatchProposalToolInputSchema,
} from "./agent-schemas";
import { storeDispatchProposal } from "./agent.service";

type ToolContext = {
  conversationId?: string;
};

type ToolExecutor = (
  auth: AuthContext,
  input: Record<string, unknown>,
  context?: ToolContext,
) => Promise<unknown>;

type AgentTool = {
  definition: Anthropic.Tool;
  execute: ToolExecutor;
};

const managerOnlyReadTools = new Set([
  "list_jobs",
  "list_memberships",
  "list_activity_feed",
  "check_schedule_conflicts",
  "save_dispatch_proposal",
]);

function canAccessTool(auth: AuthContext, toolName: string): boolean {
  if (auth.role === MembershipRole.STAFF && managerOnlyReadTools.has(toolName)) {
    return false;
  }

  return true;
}

async function safeExecute(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      error: true,
      message,
      ...(error instanceof ApiError && error.details ? { details: error.details } : {}),
    };
  }
}

function formatToolValidationError(error: z.ZodError) {
  return {
    error: true,
    message: "Tool input validation failed.",
    details: error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

async function safeExecuteWithSchema<T>(
  schema: z.ZodType<T>,
  input: Record<string, unknown>,
  fn: (validatedInput: T) => Promise<unknown>,
): Promise<unknown> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return formatToolValidationError(parsed.error);
  }

  return safeExecute(() => fn(parsed.data));
}

const toolMap = new Map<string, AgentTool>();

toolMap.set("list_jobs", {
  definition: {
    name: "list_jobs",
    description: "Search and list jobs/work orders by keyword, status, customer, or schedule range.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        status: {
          type: "string",
          enum: [
            "NEW",
            "SCHEDULED",
            "IN_PROGRESS",
            "PENDING_REVIEW",
            "COMPLETED",
            "CANCELLED",
          ],
        },
        customerId: { type: "string" },
        scheduledFrom: { type: "string" },
        scheduledTo: { type: "string" },
        page: { type: "number" },
        pageSize: { type: "number" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(listJobsToolInputSchema, input, (validatedInput) =>
      jobService.listJobs(auth, {
        q: validatedInput.q,
        status: validatedInput.status,
        customerId: validatedInput.customerId,
        scheduledFrom: validatedInput.scheduledFrom,
        scheduledTo: validatedInput.scheduledTo,
        page: validatedInput.page,
        pageSize: validatedInput.pageSize,
        sort: "createdAt_desc",
      }),
    ),
});

toolMap.set("get_job_detail", {
  definition: {
    name: "get_job_detail",
    description: "Get the detail for one job.",
    input_schema: {
      type: "object" as const,
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(getJobDetailToolInputSchema, input, (validatedInput) =>
      jobService.getJobDetail(auth, validatedInput.jobId),
    ),
});

toolMap.set("list_customers", {
  definition: {
    name: "list_customers",
    description: "Search customers by name, phone, or email.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        page: { type: "number" },
        pageSize: { type: "number" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(listCustomersToolInputSchema, input, (validatedInput) =>
      customerService.listCustomers(auth, {
        q: validatedInput.q,
        page: validatedInput.page,
        pageSize: validatedInput.pageSize,
        status: "active",
        sort: "createdAt_desc",
      }),
    ),
});

toolMap.set("get_customer_detail", {
  definition: {
    name: "get_customer_detail",
    description: "Get customer detail including recent jobs.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: { type: "string" },
      },
      required: ["customerId"],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(getCustomerDetailToolInputSchema, input, (validatedInput) =>
      customerService.getCustomerDetail(auth, validatedInput.customerId),
    ),
});

toolMap.set("list_memberships", {
  definition: {
    name: "list_memberships",
    description: "Search active team members to find a dispatch assignee.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        role: {
          type: "string",
          enum: ["OWNER", "MANAGER", "STAFF"],
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INVITED", "DISABLED"],
        },
        page: { type: "number" },
        pageSize: { type: "number" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(listMembershipsToolInputSchema, input, (validatedInput) =>
      membershipService.listMemberships(auth, {
        q: validatedInput.q,
        role: validatedInput.role,
        status: validatedInput.status,
        page: validatedInput.page,
        pageSize: validatedInput.pageSize,
      }),
    ),
});

toolMap.set("list_activity_feed", {
  definition: {
    name: "list_activity_feed",
    description: "Get recent workspace activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: { type: "number" },
        pageSize: { type: "number" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(listActivityFeedToolInputSchema, input, (validatedInput) =>
      auditService.listActivityFeed(auth, {
        page: validatedInput.page,
        pageSize: validatedInput.pageSize,
      }),
    ),
});

toolMap.set("check_schedule_conflicts", {
  definition: {
    name: "check_schedule_conflicts",
    description: "Check whether a staff member already has overlapping jobs in a proposed time window.",
    input_schema: {
      type: "object" as const,
      properties: {
        assigneeUserId: { type: "string" },
        scheduledStartAt: { type: "string" },
        scheduledEndAt: { type: "string" },
        excludeJobId: { type: "string" },
      },
      required: ["assigneeUserId", "scheduledStartAt", "scheduledEndAt"],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(checkScheduleConflictsToolInputSchema, input, (validatedInput) =>
      jobService.checkScheduleConflicts(auth, {
        assigneeUserId: validatedInput.assigneeUserId,
        scheduledStartAt: validatedInput.scheduledStartAt,
        scheduledEndAt: validatedInput.scheduledEndAt,
        excludeJobId: validatedInput.excludeJobId,
      }),
    ),
});

toolMap.set("save_dispatch_proposal", {
  definition: {
    name: "save_dispatch_proposal",
    description: "Save a structured dispatch plan for manager confirmation. Use this after gathering enough context.",
    input_schema: {
      type: "object" as const,
      properties: {
        intent: { type: "string" },
        customer: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["matched", "new", "missing", "ambiguous"],
            },
            query: { type: "string" },
            matchedCustomerId: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            notes: { type: "string" },
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                },
                required: ["id", "name"],
              },
            },
          },
          required: ["status"],
        },
        jobDraft: {
          type: "object",
          properties: {
            existingJobId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["title"],
        },
        scheduleDraft: {
          type: "object",
          properties: {
            scheduledStartAt: { type: "string" },
            scheduledEndAt: { type: "string" },
            timezone: { type: "string" },
          },
          required: ["timezone"],
        },
        assigneeDraft: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["matched", "missing", "ambiguous"],
            },
            membershipId: { type: "string" },
            userId: { type: "string" },
            displayName: { type: "string" },
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  membershipId: { type: "string" },
                  userId: { type: "string" },
                  displayName: { type: "string" },
                },
                required: ["membershipId", "userId", "displayName"],
              },
            },
          },
          required: ["status"],
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        confidence: { type: "number" },
      },
      required: ["intent", "customer", "jobDraft", "scheduleDraft", "warnings", "confidence"],
    },
  },
  execute: async (auth, input, context) => {
    if (!context?.conversationId) {
      return {
        error: true,
        message: "Conversation context is missing.",
      };
    }

    const conversationId = context.conversationId;

    return safeExecuteWithSchema(
      saveDispatchProposalToolInputSchema,
      input,
      async (validatedInput) => {
        const proposal = await storeDispatchProposal(auth, conversationId, {
          intent: validatedInput.intent,
          customer: validatedInput.customer,
          jobDraft: {
            existingJobId: validatedInput.jobDraft.existingJobId,
            title: validatedInput.jobDraft.title,
            description: validatedInput.jobDraft.description ?? null,
          },
          scheduleDraft: validatedInput.scheduleDraft,
          assigneeDraft: validatedInput.assigneeDraft,
          warnings: validatedInput.warnings,
          confidence: validatedInput.confidence,
        });

        return {
          saved: true,
          proposalId: proposal.id,
          proposal,
        };
      },
    );
  },
});

export function getToolDefinitions(auth: AuthContext): Anthropic.Tool[] {
  return Array.from(toolMap.entries())
    .filter(([toolName]) => canAccessTool(auth, toolName))
    .map(([, tool]) => tool.definition);
}

export async function executeTool(
  auth: AuthContext,
  toolName: string,
  input: Record<string, unknown>,
  context?: ToolContext,
): Promise<unknown> {
  if (!canAccessTool(auth, toolName)) {
    return {
      error: true,
      message: "Permission denied: your role cannot use this tool.",
    };
  }

  const tool = toolMap.get(toolName);
  if (!tool) {
    return { error: true, message: `Unknown tool: ${toolName}` };
  }

  return tool.execute(auth, input, context);
}
