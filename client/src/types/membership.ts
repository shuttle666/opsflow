import type { MembershipRole, MembershipStatus } from "@/types/auth";

export type MembershipListQuery = {
  status?: MembershipStatus;
  role?: MembershipRole;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type MembershipListItem = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
};

export type UpdateMembershipRequest = {
  role?: MembershipRole;
  status?: Extract<MembershipStatus, "ACTIVE" | "DISABLED">;
};
