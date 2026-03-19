import { MembershipRole } from "@prisma/client";

export type Permission =
  | "tenant.members.invite"
  | "tenant.members.disable"
  | "customers.read"
  | "customers.write"
  | "jobs.read"
  | "jobs.write";

export const rolePermissions: Record<MembershipRole, Permission[]> = {
  [MembershipRole.OWNER]: [
    "tenant.members.invite",
    "tenant.members.disable",
    "customers.read",
    "customers.write",
    "jobs.read",
    "jobs.write",
  ],
  [MembershipRole.MANAGER]: [
    "tenant.members.invite",
    "customers.read",
    "customers.write",
    "jobs.read",
    "jobs.write",
  ],
  [MembershipRole.STAFF]: ["customers.read", "jobs.read", "jobs.write"],
};

export function hasPermission(role: MembershipRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
