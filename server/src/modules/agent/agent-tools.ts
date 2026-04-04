import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../../types/auth";
import * as auditService from "../audit/audit.service";
import * as customerService from "../customer/customer.service";
import * as jobService from "../job/job.service";
import * as membershipService from "../membership/membership.service";
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
    return { error: true, message };
  }
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
          enum: ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
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
    safeExecute(() =>
      jobService.listJobs(auth, {
        q: input.q as string | undefined,
        status: input.status as never,
        customerId: input.customerId as string | undefined,
        scheduledFrom: input.scheduledFrom as string | undefined,
        scheduledTo: input.scheduledTo as string | undefined,
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
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
    safeExecute(() => jobService.getJobDetail(auth, input.jobId as string)),
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
    safeExecute(() =>
      customerService.listCustomers(auth, {
        q: input.q as string | undefined,
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
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
    safeExecute(() =>
      customerService.getCustomerDetail(auth, input.customerId as string),
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
    safeExecute(() =>
      membershipService.listMemberships(auth, {
        q: input.q as string | undefined,
        role: input.role as never,
        status: input.status as never,
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
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
    safeExecute(() =>
      auditService.listActivityFeed(auth, {
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
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
    safeExecute(() =>
      jobService.checkScheduleConflicts(auth, {
        assigneeUserId: input.assigneeUserId as string,
        scheduledStartAt: input.scheduledStartAt as string,
        scheduledEndAt: input.scheduledEndAt as string,
        excludeJobId: input.excludeJobId as string | undefined,
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

    return safeExecute(async () => {
      const proposal = storeDispatchProposal(auth, conversationId, {
        intent: String(input.intent ?? "dispatch_plan"),
        customer: {
          status: input.customer && typeof input.customer === "object"
            ? (input.customer as { status: "matched" | "new" | "missing" | "ambiguous" }).status
            : "missing",
          ...(input.customer && typeof input.customer === "object"
            ? {
                query: (input.customer as { query?: string }).query,
                matchedCustomerId: (input.customer as { matchedCustomerId?: string }).matchedCustomerId,
                name: (input.customer as { name?: string }).name,
                phone: (input.customer as { phone?: string }).phone,
                email: (input.customer as { email?: string }).email,
                address: (input.customer as { address?: string }).address,
                notes: (input.customer as { notes?: string }).notes,
                matches: (input.customer as { matches?: Array<{ id: string; name: string }> }).matches,
              }
            : {}),
        },
        jobDraft: {
          title: String((input.jobDraft as { title?: string } | undefined)?.title ?? ""),
          description: (input.jobDraft as { description?: string } | undefined)?.description ?? null,
        },
        scheduleDraft: {
          scheduledStartAt:
            (input.scheduleDraft as { scheduledStartAt?: string } | undefined)?.scheduledStartAt ?? null,
          scheduledEndAt:
            (input.scheduleDraft as { scheduledEndAt?: string } | undefined)?.scheduledEndAt ?? null,
          timezone: String((input.scheduleDraft as { timezone?: string } | undefined)?.timezone ?? "UTC"),
        },
        assigneeDraft:
          input.assigneeDraft && typeof input.assigneeDraft === "object"
            ? {
                status: (input.assigneeDraft as { status: "matched" | "missing" | "ambiguous" }).status,
                membershipId: (input.assigneeDraft as { membershipId?: string }).membershipId,
                userId: (input.assigneeDraft as { userId?: string }).userId,
                displayName: (input.assigneeDraft as { displayName?: string }).displayName,
                matches: (input.assigneeDraft as {
                  matches?: Array<{
                    membershipId: string;
                    userId: string;
                    displayName: string;
                  }>;
                }).matches,
              }
            : undefined,
        warnings: Array.isArray(input.warnings)
          ? input.warnings.map((warning) => String(warning))
          : [],
        confidence:
          typeof input.confidence === "number"
            ? input.confidence
            : Number(input.confidence ?? 0.5),
      });

      return {
        saved: true,
        proposalId: proposal.id,
        proposal,
      };
    });
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
