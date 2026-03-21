import { MembershipRole, MembershipStatus } from "@prisma/client";
import { z } from "zod";

export const membershipIdParamSchema = z.object({
  membershipId: z.uuid(),
});

export const membershipListQuerySchema = z.object({
  status: z.nativeEnum(MembershipStatus).optional(),
  role: z.nativeEnum(MembershipRole).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const updateMembershipSchema = z
  .object({
    role: z.nativeEnum(MembershipRole).optional(),
    status: z
      .enum([MembershipStatus.ACTIVE, MembershipStatus.DISABLED])
      .optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "At least one membership field must be provided.",
  });

export type MembershipIdParamInput = z.infer<typeof membershipIdParamSchema>;
export type MembershipListQueryInput = z.infer<typeof membershipListQuerySchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
