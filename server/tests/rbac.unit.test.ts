import { MembershipRole } from "@prisma/client";
import { hasPermission } from "../src/modules/auth/auth-rbac";

describe("rbac permission matrix", () => {
  it("allows owner to manage tenant members", () => {
    expect(hasPermission(MembershipRole.OWNER, "tenant.members.invite")).toBe(
      true,
    );
  });

  it("allows manager to invite but not disable members", () => {
    expect(hasPermission(MembershipRole.MANAGER, "tenant.members.invite")).toBe(
      true,
    );
    expect(
      hasPermission(MembershipRole.MANAGER, "tenant.members.disable"),
    ).toBe(false);
  });

  it("prevents staff from member management actions", () => {
    expect(hasPermission(MembershipRole.STAFF, "tenant.members.invite")).toBe(
      false,
    );
  });
});

