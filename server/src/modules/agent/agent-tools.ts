import type Anthropic from "@anthropic-ai/sdk";
import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../../types/auth";
import * as jobService from "../job/job.service";
import * as customerService from "../customer/customer.service";
import * as membershipService from "../membership/membership.service";
import * as auditService from "../audit/audit.service";

type ToolExecutor = (
  auth: AuthContext,
  input: Record<string, unknown>,
) => Promise<unknown>;

type AgentTool = {
  definition: Anthropic.Tool;
  execute: ToolExecutor;
};

const managerOnlyReadTools = new Set([
  "list_jobs",
  "list_memberships",
  "list_activity_feed",
]);

function requireManagerRole(auth: AuthContext): string | null {
  if (auth.role === MembershipRole.STAFF) {
    return "Permission denied: only OWNER or MANAGER can perform this action.";
  }
  return null;
}

function canAccessTool(auth: AuthContext, toolName: string): boolean {
  if (
    auth.role === MembershipRole.STAFF &&
    managerOnlyReadTools.has(toolName)
  ) {
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
    description:
      "Search and list jobs/work orders. Use this to find jobs by keyword, status, customer, or date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search keyword for job title, description, or customer name" },
        status: {
          type: "string",
          enum: ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
          description: "Filter by job status",
        },
        customerId: { type: "string", description: "Filter by customer ID (UUID)" },
        scheduledFrom: { type: "string", description: "Filter jobs scheduled after this ISO-8601 datetime" },
        scheduledTo: { type: "string", description: "Filter jobs scheduled before this ISO-8601 datetime" },
        page: { type: "number", description: "Page number (default 1)" },
        pageSize: { type: "number", description: "Items per page (default 10, max 50)" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecute(() =>
      jobService.listJobs(auth, {
        q: input.q as string | undefined,
        status: input.status as any,
        customerId: input.customerId as string | undefined,
        scheduledFrom: input.scheduledFrom as string | undefined,
        scheduledTo: input.scheduledTo as string | undefined,
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
        sort: "createdAt_desc",
      }),
    ),
});

toolMap.set("create_job", {
  definition: {
    name: "create_job",
    description:
      "Create a new job/work order. Requires a customer ID and title. Always search for the customer first to get their ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: { type: "string", description: "Customer ID (UUID). Search customers first to get this." },
        title: { type: "string", description: "Job title describing the work to be done" },
        description: { type: "string", description: "Detailed description of the job" },
        scheduledAt: { type: "string", description: "Scheduled date/time in ISO-8601 format with timezone offset" },
      },
      required: ["customerId", "title"],
    },
  },
  execute: (auth, input) => {
    const denied = requireManagerRole(auth);
    if (denied) return Promise.resolve({ error: true, message: denied });
    return safeExecute(() =>
      jobService.createJob(auth, {
        customerId: input.customerId as string,
        title: input.title as string,
        description: input.description as string | undefined,
        scheduledAt: input.scheduledAt as string | undefined,
      }),
    );
  },
});

toolMap.set("get_job_detail", {
  definition: {
    name: "get_job_detail",
    description: "Get detailed information about a specific job including customer info, assignee, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        jobId: { type: "string", description: "Job ID (UUID)" },
      },
      required: ["jobId"],
    },
  },
  execute: (auth, input) =>
    safeExecute(() => jobService.getJobDetail(auth, input.jobId as string)),
});

toolMap.set("assign_job", {
  definition: {
    name: "assign_job",
    description:
      "Assign a job to a staff member. Requires the job ID and the membership ID of the staff member. Search memberships first to find the right person.",
    input_schema: {
      type: "object" as const,
      properties: {
        jobId: { type: "string", description: "Job ID (UUID)" },
        membershipId: { type: "string", description: "Membership ID (UUID) of the staff member to assign. Search memberships first to get this." },
      },
      required: ["jobId", "membershipId"],
    },
  },
  execute: (auth, input) => {
    const denied = requireManagerRole(auth);
    if (denied) return Promise.resolve({ error: true, message: denied });
    return safeExecute(() =>
      jobService.assignJob(auth, input.jobId as string, {
        membershipId: input.membershipId as string,
      }),
    );
  },
});

toolMap.set("transition_job_status", {
  definition: {
    name: "transition_job_status",
    description:
      "Change the status of a job. Valid transitions: NEW->SCHEDULED, NEW->CANCELLED, SCHEDULED->IN_PROGRESS, SCHEDULED->CANCELLED, IN_PROGRESS->COMPLETED, IN_PROGRESS->CANCELLED. A reason is required when cancelling.",
    input_schema: {
      type: "object" as const,
      properties: {
        jobId: { type: "string", description: "Job ID (UUID)" },
        toStatus: {
          type: "string",
          enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
          description: "Target status",
        },
        reason: { type: "string", description: "Reason for the transition (required for CANCELLED)" },
      },
      required: ["jobId", "toStatus"],
    },
  },
  execute: (auth, input) =>
    safeExecute(() =>
      jobService.transitionJobStatusForActor(auth, input.jobId as string, {
        toStatus: input.toStatus as any,
        reason: input.reason as string | undefined,
      }),
    ),
});

toolMap.set("list_customers", {
  definition: {
    name: "list_customers",
    description: "Search and list customers by name, phone, or email.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search keyword for customer name, phone, or email" },
        page: { type: "number", description: "Page number (default 1)" },
        pageSize: { type: "number", description: "Items per page (default 10, max 50)" },
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

toolMap.set("create_customer", {
  definition: {
    name: "create_customer",
    description: "Create a new customer record.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Customer name" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address" },
        address: { type: "string", description: "Address" },
        notes: { type: "string", description: "Additional notes" },
      },
      required: ["name"],
    },
  },
  execute: (auth, input) => {
    const denied = requireManagerRole(auth);
    if (denied) return Promise.resolve({ error: true, message: denied });
    return safeExecute(() =>
      customerService.createCustomer(auth, {
        name: input.name as string,
        phone: input.phone as string | undefined,
        email: input.email as string | undefined,
        address: input.address as string | undefined,
        notes: input.notes as string | undefined,
      }),
    );
  },
});

toolMap.set("get_customer_detail", {
  definition: {
    name: "get_customer_detail",
    description: "Get detailed information about a specific customer, including their recent jobs.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: { type: "string", description: "Customer ID (UUID)" },
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
    description:
      "Search and list team members/staff. Use this to find staff members for job assignment.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search keyword for member name or email" },
        role: {
          type: "string",
          enum: ["OWNER", "MANAGER", "STAFF"],
          description: "Filter by role",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INVITED", "DISABLED"],
          description: "Filter by status (default shows all)",
        },
        page: { type: "number", description: "Page number (default 1)" },
        pageSize: { type: "number", description: "Items per page (default 10, max 50)" },
      },
      required: [],
    },
  },
  execute: (auth, input) =>
    safeExecute(() =>
      membershipService.listMemberships(auth, {
        q: input.q as string | undefined,
        role: input.role as any,
        status: input.status as any,
        page: (input.page as number) ?? 1,
        pageSize: (input.pageSize as number) ?? 10,
      }),
    ),
});

toolMap.set("list_activity_feed", {
  definition: {
    name: "list_activity_feed",
    description: "Get the recent activity feed/audit log for this workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        pageSize: { type: "number", description: "Items per page (default 10, max 50)" },
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

export function getToolDefinitions(auth: AuthContext): Anthropic.Tool[] {
  return Array.from(toolMap.entries())
    .filter(([toolName]) => canAccessTool(auth, toolName))
    .map(([, tool]) => tool.definition);
}

export async function executeTool(
  auth: AuthContext,
  toolName: string,
  input: Record<string, unknown>,
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
  return tool.execute(auth, input);
}
