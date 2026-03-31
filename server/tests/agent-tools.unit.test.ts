import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const serviceMocks = vi.hoisted(() => ({
  listJobs: vi.fn(),
  listMemberships: vi.fn(),
  listActivityFeed: vi.fn(),
}));

vi.mock("../src/modules/job/job.service", () => ({
  listJobs: serviceMocks.listJobs,
  createJob: vi.fn(),
  getJobDetail: vi.fn(),
  assignJob: vi.fn(),
  transitionJobStatusForActor: vi.fn(),
}));

vi.mock("../src/modules/customer/customer.service", () => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
  getCustomerDetail: vi.fn(),
}));

vi.mock("../src/modules/membership/membership.service", () => ({
  listMemberships: serviceMocks.listMemberships,
}));

vi.mock("../src/modules/audit/audit.service", () => ({
  listActivityFeed: serviceMocks.listActivityFeed,
}));

import {
  executeTool,
  getToolDefinitions,
} from "../src/modules/agent/agent-tools";

function buildAuth(role: MembershipRole): AuthContext {
  return {
    userId: "user-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    role,
  };
}

describe("agent tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides manager-only read tools from staff users", () => {
    const definitions = getToolDefinitions(buildAuth(MembershipRole.STAFF));
    const toolNames = definitions.map((tool) => tool.name);

    expect(toolNames).not.toContain("list_jobs");
    expect(toolNames).not.toContain("list_memberships");
    expect(toolNames).not.toContain("list_activity_feed");
  });

  it("keeps manager-only read tools visible for manager users", () => {
    const definitions = getToolDefinitions(buildAuth(MembershipRole.MANAGER));
    const toolNames = definitions.map((tool) => tool.name);

    expect(toolNames).toContain("list_jobs");
    expect(toolNames).toContain("list_memberships");
    expect(toolNames).toContain("list_activity_feed");
  });

  it("rejects restricted tools for staff before calling the service", async () => {
    const result = await executeTool(buildAuth(MembershipRole.STAFF), "list_jobs", {});

    expect(result).toEqual({
      error: true,
      message: "Permission denied: your role cannot use this tool.",
    });
    expect(serviceMocks.listJobs).not.toHaveBeenCalled();
  });

  it("allows manager users to execute permitted tools", async () => {
    serviceMocks.listJobs.mockResolvedValueOnce({ items: [], pagination: { page: 1 } });

    const result = await executeTool(buildAuth(MembershipRole.MANAGER), "list_jobs", {
      page: 1,
    });

    expect(serviceMocks.listJobs).toHaveBeenCalledWith(buildAuth(MembershipRole.MANAGER), {
      q: undefined,
      status: undefined,
      customerId: undefined,
      scheduledFrom: undefined,
      scheduledTo: undefined,
      page: 1,
      pageSize: 10,
      sort: "createdAt_desc",
    });
    expect(result).toEqual({ items: [], pagination: { page: 1 } });
  });
});
