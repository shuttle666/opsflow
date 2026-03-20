import { InvitationStatus, MembershipRole } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  tenantName: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.uuid().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const logoutSchema = z.object({
  allDevices: z.boolean().optional().default(false),
});

export const switchTenantSchema = z.object({
  tenantId: z.uuid(),
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum([MembershipRole.MANAGER, MembershipRole.STAFF]),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20),
});

export const invitationIdParamSchema = z.object({
  invitationId: z.uuid(),
});

export const tenantInvitationListQuerySchema = z.object({
  status: z.enum([
    InvitationStatus.PENDING,
    InvitationStatus.ACCEPTED,
    InvitationStatus.CANCELLED,
    InvitationStatus.EXPIRED,
  ]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type InvitationIdParamInput = z.infer<typeof invitationIdParamSchema>;
export type TenantInvitationListQueryInput = z.infer<typeof tenantInvitationListQuerySchema>;
