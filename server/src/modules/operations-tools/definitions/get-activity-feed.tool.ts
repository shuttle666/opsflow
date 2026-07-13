import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import * as auditService from "../../audit/audit.service";
import type { OpsFlowTool } from "../tool-types";
import { paginationSchema } from "./shared-schemas";

const inputSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
const outputSchema = z.object({
  activities: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      timestamp: z.date(),
      tone: z.enum(["brand", "success", "warning", "neutral"]),
      targetType: z.string().optional(),
      targetId: z.string().optional(),
    }),
  ),
  pagination: paginationSchema,
});

export const getActivityFeedTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "get_activity_feed",
  title: "Get activity feed",
  description: "Get recent operational activity for the authenticated workspace.",
  audiences: ["web-agent"],
  allowedRoles: [MembershipRole.OWNER, MembershipRole.MANAGER],
  inputSchema,
  outputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  execute: async (auth, input) => {
    const result = await auditService.listActivityFeed(auth, input);
    return { activities: result.items, pagination: result.pagination };
  },
};
