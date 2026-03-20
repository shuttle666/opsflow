export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type MembershipRole = "OWNER" | "MANAGER" | "STAFF";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: MembershipRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
  tenantId?: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  tenantName?: string;
};

export type AuthResult = AuthTokens & {
  expiresInMinutes: number;
  user: AuthUser;
  currentTenant: TenantMembership;
  availableTenants: TenantMembership[];
};

export type MeResult = {
  user: AuthUser;
  currentTenant: TenantMembership;
  availableTenants: TenantMembership[];
};

export type InvitationAcceptedResult = {
  tenantId: string;
  role: MembershipRole;
};

export type InvitationCreateInput = {
  email: string;
  role: Extract<MembershipRole, "MANAGER" | "STAFF">;
};

export type InvitationCreatedResult = {
  id: string;
  tenantId: string;
  email: string;
  role: Extract<MembershipRole, "MANAGER" | "STAFF">;
  expiresAt: string;
};

export type MyInvitationItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type TenantInvitationItem = {
  id: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    displayName: string;
  };
};

export type TenantInvitationMutationResult = {
  id: string;
  status: InvitationStatus;
  expiresAt: string;
};
