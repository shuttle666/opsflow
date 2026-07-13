import { JobStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const serviceMocks = vi.hoisted(() => ({
  getJobDetail: vi.fn(),
  checkScheduleConflicts: vi.fn(),
  listCustomers: vi.fn(),
  getCustomerDetail: vi.fn(),
  listMemberships: vi.fn(),
  listActivityFeed: vi.fn(),
}));

vi.mock("../src/modules/job/job.service", () => ({
  listJobs: vi.fn(),
  getJobDetail: serviceMocks.getJobDetail,
  checkScheduleConflicts: serviceMocks.checkScheduleConflicts,
}));
vi.mock("../src/modules/customer/customer.service", () => ({
  listCustomers: serviceMocks.listCustomers,
  getCustomerDetail: serviceMocks.getCustomerDetail,
}));
vi.mock("../src/modules/membership/membership.service", () => ({
  listMemberships: serviceMocks.listMemberships,
}));
vi.mock("../src/modules/audit/audit.service", () => ({
  listActivityFeed: serviceMocks.listActivityFeed,
}));

import { checkScheduleConflictsTool } from "../src/modules/operations-tools/definitions/check-schedule-conflicts.tool";
import { getActivityFeedTool } from "../src/modules/operations-tools/definitions/get-activity-feed.tool";
import { getCustomerTool } from "../src/modules/operations-tools/definitions/get-customer.tool";
import { getJobTool } from "../src/modules/operations-tools/definitions/get-job.tool";
import { searchCustomersTool } from "../src/modules/operations-tools/definitions/search-customers.tool";
import { searchStaffTool } from "../src/modules/operations-tools/definitions/search-staff.tool";
import { opsFlowToolRegistry } from "../src/modules/operations-tools";

const auth: AuthContext = {
  userId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  role: MembershipRole.MANAGER,
};
const context = { source: "WEB_AGENT" as const, invocationId: "invocation-1" };
const pagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

describe("canonical read tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes only the intended read surface to external MCP clients", () => {
    const names = opsFlowToolRegistry
      .list({ auth, audience: "external-mcp" })
      .map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "search_jobs",
        "get_job",
        "search_customers",
        "get_customer",
        "search_staff",
        "check_schedule_conflicts",
      ]),
    );
    expect(names).not.toContain("get_activity_feed");
  });

  it("wraps job and customer details in named outputs", async () => {
    const job = {
      id: "job-1",
      title: "Leak repair",
      serviceAddress: "1 King Street",
      description: null,
      status: JobStatus.NEW,
      scheduledStartAt: null,
      scheduledEndAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: "customer-1", name: "Archie", phone: null, email: null },
      createdBy: { id: "user-1", displayName: "Manager", email: "m@example.com" },
    };
    const customer = {
      id: "customer-1",
      name: "Archie",
      phone: null,
      email: null,
      notes: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: "user-1", displayName: "Manager", email: "m@example.com" },
      jobs: [],
    };
    serviceMocks.getJobDetail.mockResolvedValueOnce(job);
    serviceMocks.getCustomerDetail.mockResolvedValueOnce(customer);

    await expect(
      getJobTool.execute(
        auth,
        { jobId: "11111111-1111-4111-8111-111111111111" },
        context,
      ),
    ).resolves.toEqual({ job });
    await expect(
      getCustomerTool.execute(
        auth,
        { customerId: "22222222-2222-4222-8222-222222222222" },
        context,
      ),
    ).resolves.toEqual({ customer });
  });

  it("normalizes customer and active staff search outputs", async () => {
    serviceMocks.listCustomers.mockResolvedValueOnce({ items: [], pagination });
    serviceMocks.listMemberships.mockResolvedValueOnce({
      items: [
        {
          id: "membership-1",
          userId: "staff-1",
          displayName: "Alex",
          email: "alex@example.com",
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
          createdAt: new Date(),
        },
      ],
      pagination,
    });

    await expect(
      searchCustomersTool.execute(
        auth,
        { q: "Archie", page: 1, pageSize: 10 },
        context,
      ),
    ).resolves.toEqual({ customers: [], pagination });
    await expect(
      searchStaffTool.execute(
        auth,
        { q: "Alex", page: 1, pageSize: 10 },
        context,
      ),
    ).resolves.toEqual({
      staff: [
        { membershipId: "membership-1", userId: "staff-1", displayName: "Alex" },
      ],
      pagination,
    });
    expect(serviceMocks.listMemberships).toHaveBeenCalledWith(auth, {
      q: "Alex",
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
      page: 1,
      pageSize: 10,
    });
  });

  it("delegates conflict checks and normalizes activity outputs", async () => {
    serviceMocks.checkScheduleConflicts.mockResolvedValueOnce({
      hasConflict: false,
      conflicts: [],
    });
    serviceMocks.listActivityFeed.mockResolvedValueOnce({ items: [], pagination });

    await expect(
      checkScheduleConflictsTool.execute(
        auth,
        {
          assigneeUserId: "11111111-1111-4111-8111-111111111111",
          scheduledStartAt: "2026-07-15T00:00:00.000Z",
          scheduledEndAt: "2026-07-15T01:00:00.000Z",
        },
        context,
      ),
    ).resolves.toEqual({ hasConflict: false, conflicts: [] });
    await expect(
      getActivityFeedTool.execute(auth, { page: 1, pageSize: 10 }, context),
    ).resolves.toEqual({ activities: [], pagination });
  });
});
