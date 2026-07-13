import { JobStatus } from "@prisma/client";
import { z } from "zod";
import * as jobService from "../../job/job.service";
import type { OpsFlowTool } from "../tool-types";

const inputSchema = z.object({ jobId: z.uuid() }).strict();
const actorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
});
const outputSchema = z.object({
  job: z.object({
    id: z.string(),
    title: z.string(),
    serviceAddress: z.string(),
    description: z.string().nullable(),
    status: z.nativeEnum(JobStatus),
    scheduledStartAt: z.date().nullable(),
    scheduledEndAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    customer: z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string().nullish(),
      email: z.string().nullish(),
    }),
    createdBy: actorSchema,
    assignedTo: actorSchema.optional(),
  }),
});

export const getJobTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "get_job",
  title: "Get job",
  description: "Get tenant-scoped detail for one job by its resolved ID.",
  audiences: ["web-agent", "external-mcp"],
  inputSchema,
  outputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  execute: async (auth, input) => ({
    job: await jobService.getJobDetail(auth, input.jobId),
  }),
};
