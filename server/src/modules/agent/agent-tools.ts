import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../../types/auth";
import { safeExecuteWithSchema } from "../ai";
import * as auditService from "../audit/audit.service";
import * as customerService from "../customer/customer.service";
import * as jobService from "../job/job.service";
import * as membershipService from "../membership/membership.service";
import {
  checkScheduleConflictsToolInputSchema,
  classifyIntentToolInputSchema,
  getCustomerDetailToolInputSchema,
  getJobDetailToolInputSchema,
  listActivityFeedToolInputSchema,
  listCustomersToolInputSchema,
  listJobsToolInputSchema,
  listMembershipsToolInputSchema,
  resolveCustomerTargetToolInputSchema,
  resolveJobTargetToolInputSchema,
  resolveStaffTargetToolInputSchema,
  resolveTimeWindowToolInputSchema,
  saveDispatchProposalToolInputSchema,
  saveTypedProposalToolInputSchema,
} from "./agent-schemas";
import { classifyAgentIntent } from "./intent-router";
import { storeDispatchProposal, storeTypedProposal } from "./agent.service";
import {
  resolveCustomerTarget,
  resolveJobTarget,
  resolveStaffTarget,
  resolveTimeWindow,
} from "./target-resolvers";

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
  "resolve_job_target",
  "resolve_staff_target",
  "save_dispatch_proposal",
  "save_typed_proposal",
]);

function canAccessTool(auth: AuthContext, toolName: string): boolean {
  if (auth.role === MembershipRole.STAFF && managerOnlyReadTools.has(toolName)) {
    return false;
  }

  return true;
}

const toolMap = new Map<string, AgentTool>();

toolMap.set("classify_intent", {
  definition: {
    name: "classify_intent",
    description: "Classify the user's latest request into an OpsFlow agent intent.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string" },
      },
      required: ["content"],
    },
  },
  execute: (_auth, input) =>
    safeExecuteWithSchema(classifyIntentToolInputSchema, input, (validatedInput) =>
      Promise.resolve(classifyAgentIntent(validatedInput.content)),
    ),
});

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

toolMap.set("resolve_customer_target", {
  definition: {
    name: "resolve_customer_target",
    description: "Resolve a customer mention to one active customer, ambiguous candidates, or a new-customer candidate. Customer addresses are not supported.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(resolveCustomerTargetToolInputSchema, input, (validatedInput) =>
      resolveCustomerTarget(auth, validatedInput),
    ),
});

toolMap.set("resolve_job_target", {
  definition: {
    name: "resolve_job_target",
    description: "Resolve whether a user is referring to an existing job or a new job. Uses title, description, customer, status, and job serviceAddress.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        serviceAddress: { type: "string" },
        customerId: { type: "string" },
        includeClosed: { type: "boolean" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(resolveJobTargetToolInputSchema, input, (validatedInput) =>
      resolveJobTarget(auth, validatedInput),
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

toolMap.set("resolve_staff_target", {
  definition: {
    name: "resolve_staff_target",
    description: "Resolve a staff member mention to one active staff membership or ambiguous candidates.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
      },
      required: ["q"],
    },
  },
  execute: (auth, input) =>
    safeExecuteWithSchema(resolveStaffTargetToolInputSchema, input, (validatedInput) =>
      resolveStaffTarget(auth, validatedInput),
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

toolMap.set("resolve_time_window", {
  definition: {
    name: "resolve_time_window",
    description: "Validate and convert a proposed schedule time window. Prefer localDate/localStartTime/localEndTime with timezone; do not calculate UTC offsets yourself. Use localEndDate only when the end date differs from the start date.",
    input_schema: {
      type: "object" as const,
      properties: {
        scheduledStartAt: { type: "string" },
        scheduledEndAt: { type: "string" },
        localDate: { type: "string", description: "Local date in YYYY-MM-DD in the provided timezone." },
        localEndDate: { type: "string", description: "Optional local end date in YYYY-MM-DD when the window ends on a different local date." },
        localStartTime: { type: "string", description: "Local start time in HH:mm in the provided timezone." },
        localEndTime: { type: "string", description: "Local end time in HH:mm in the provided timezone." },
        timezone: { type: "string" },
      },
      required: ["timezone"],
    },
  },
  execute: (_auth, input) =>
    safeExecuteWithSchema(resolveTimeWindowToolInputSchema, input, (validatedInput) =>
      Promise.resolve(resolveTimeWindow(validatedInput)),
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
            serviceAddress: { type: "string" },
            description: { type: "string" },
          },
          required: ["title"],
        },
        scheduleDraft: {
          type: "object",
          properties: {
            scheduledStartAt: { type: "string" },
            scheduledEndAt: { type: "string" },
            localDate: { type: "string" },
            localEndDate: { type: "string" },
            localStartTime: { type: "string" },
            localEndTime: { type: "string" },
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
            ...(validatedInput.jobDraft.existingJobId
              ? { existingJobId: validatedInput.jobDraft.existingJobId }
              : {}),
            title: validatedInput.jobDraft.title,
            serviceAddress: validatedInput.jobDraft.serviceAddress,
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

toolMap.set("save_typed_proposal", {
  definition: {
    name: "save_typed_proposal",
    description: "Save a typed OpsFlow proposal for manager confirmation. Use this for new agent workflows instead of the legacy dispatch proposal tool. For ambiguous write requests, save an unresolved proposal and include resolver candidates under review.candidates instead of asking only in chat.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: [
            "CREATE_CUSTOMER",
            "UPDATE_CUSTOMER",
            "CREATE_JOB",
            "UPDATE_JOB",
            "ASSIGN_JOB",
            "SCHEDULE_JOB",
            "CHANGE_JOB_STATUS",
            "CANCEL_JOB",
          ],
        },
        intent: { type: "string" },
        target: {
          type: "object",
          properties: {
            customerId: { type: "string" },
            jobId: { type: "string" },
          },
          required: [],
        },
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
            serviceAddress: { type: "string" },
            description: { type: "string" },
          },
          required: ["title"],
        },
        scheduleDraft: {
          type: "object",
          properties: {
            scheduledStartAt: { type: "string" },
            scheduledEndAt: { type: "string" },
            localDate: { type: "string" },
            localEndDate: { type: "string" },
            localStartTime: { type: "string" },
            localEndTime: { type: "string" },
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
        statusDraft: {
          type: "object",
          properties: {
            toStatus: {
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
            reason: { type: "string" },
          },
          required: ["toStatus"],
        },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                enum: ["name", "phone", "email", "notes"],
              },
              from: { type: ["string", "null"] },
              to: { type: ["string", "null"] },
            },
            required: ["field", "from", "to"],
          },
        },
        review: {
          type: "object",
          properties: {
            candidates: {
              type: "object",
              properties: {
                jobs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      serviceAddress: { type: "string" },
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
                      scheduledStartAt: { type: ["string", "null"] },
                      scheduledEndAt: { type: ["string", "null"] },
                      assignedToName: { type: ["string", "null"] },
                      customer: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                        },
                        required: ["id", "name"],
                      },
                      score: { type: "number" },
                    },
                    required: ["id", "title", "status"],
                  },
                },
              },
              required: [],
            },
          },
          required: [],
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        confidence: { type: "number" },
      },
      required: ["type", "customer", "confidence"],
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
      saveTypedProposalToolInputSchema,
      input,
      async (validatedInput) => {
        const proposal = await storeTypedProposal(auth, conversationId, validatedInput);

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
