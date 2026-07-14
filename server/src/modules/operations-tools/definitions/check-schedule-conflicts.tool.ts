import { JobStatus, MembershipRole } from "@prisma/client";
import { z } from "zod";
import * as jobService from "../../job/job.service";
import type { OpsFlowTool } from "../tool-types";

const inputSchema = z
  .object({
    assigneeUserId: z.uuid(),
    scheduledStartAt: z.string().trim().datetime({ offset: true }),
    scheduledEndAt: z.string().trim().datetime({ offset: true }),
    excludeJobId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.scheduledEndAt) <= new Date(value.scheduledStartAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledEndAt"],
        message: "End time must be after the start time.",
      });
    }
  });
const outputSchema = z.object({
  hasConflict: z.boolean(),
  conflicts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      serviceAddress: z.string(),
      status: z.nativeEnum(JobStatus),
      scheduledStartAt: z.date(),
      scheduledEndAt: z.date(),
      customer: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
});

export const checkScheduleConflictsTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "check_schedule_conflicts",
  title: "Check schedule conflicts",
  description:
    "Check whether a resolved staff user has overlapping jobs in a proposed time window.",
  audiences: ["web-agent", "external-mcp"],
  allowedRoles: [MembershipRole.OWNER, MembershipRole.MANAGER],
  inputSchema,
  outputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  conversationContext: "none",
  execute: (auth, input) => jobService.checkScheduleConflicts(auth, input),
};
