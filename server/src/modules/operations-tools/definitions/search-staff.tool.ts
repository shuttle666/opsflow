import { MembershipRole, MembershipStatus } from "@prisma/client";
import { z } from "zod";
import * as membershipService from "../../membership/membership.service";
import type { OpsFlowTool } from "../tool-types";
import { paginationSchema } from "./shared-schemas";

const inputSchema = z
  .object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
const outputSchema = z.object({
  staff: z.array(
    z.object({
      membershipId: z.string(),
      userId: z.string(),
      displayName: z.string(),
    }),
  ),
  pagination: paginationSchema,
});

export const searchStaffTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "search_staff",
  title: "Search active staff",
  description: "Search active staff members that can be assigned to jobs.",
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
  execute: async (auth, input) => {
    const result = await membershipService.listMemberships(auth, {
      q: input.q,
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      staff: result.items.map((membership) => ({
        membershipId: membership.id,
        userId: membership.userId,
        displayName: membership.displayName,
      })),
      pagination: result.pagination,
    };
  },
};
