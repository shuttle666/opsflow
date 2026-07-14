import { JobStatus, MembershipRole } from "@prisma/client";
import { z } from "zod";
import * as jobService from "../../job/job.service";
import type { OpsFlowTool } from "../tool-types";
import { jobSummarySchema, paginationSchema } from "./shared-schemas";

export const searchJobsInputSchema = z
  .object({
    q: z.string().trim().optional(),
    status: z.nativeEnum(JobStatus).optional(),
    customerId: z.uuid().optional(),
    scheduledFrom: z.string().trim().datetime({ offset: true }).optional(),
    scheduledTo: z.string().trim().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

const searchJobsOutputSchema = z.object({
  jobs: z.array(jobSummarySchema),
  pagination: paginationSchema,
});

export const searchJobsTool: OpsFlowTool<
  z.infer<typeof searchJobsInputSchema>,
  z.infer<typeof searchJobsOutputSchema>
> = {
  name: "search_jobs",
  title: "Search jobs",
  description:
    "Search and list tenant-scoped jobs by keyword, status, customer, or schedule range.",
  audiences: ["web-agent", "external-mcp"],
  allowedRoles: [MembershipRole.OWNER, MembershipRole.MANAGER],
  inputSchema: searchJobsInputSchema,
  outputSchema: searchJobsOutputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  conversationContext: "none",
  execute: async (auth, input) => {
    const result = await jobService.listJobs(auth, {
      q: input.q,
      status: input.status,
      customerId: input.customerId,
      scheduledFrom: input.scheduledFrom,
      scheduledTo: input.scheduledTo,
      page: input.page,
      pageSize: input.pageSize,
      sort: "createdAt_desc",
    });

    return { jobs: result.items, pagination: result.pagination };
  },
};
