import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";
import { ApiError } from "../src/utils/api-error";

const serviceMocks = vi.hoisted(() => ({
  listJobs: vi.fn(),
  checkScheduleConflicts: vi.fn(),
  listMemberships: vi.fn(),
  listActivityFeed: vi.fn(),
  storeDispatchProposal: vi.fn(),
}));

vi.mock("../src/modules/job/job.service", () => ({
  listJobs: serviceMocks.listJobs,
  createJob: vi.fn(),
  getJobDetail: vi.fn(),
  assignJob: vi.fn(),
  checkScheduleConflicts: serviceMocks.checkScheduleConflicts,
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

vi.mock("../src/modules/agent/agent.service", () => ({
  storeDispatchProposal: serviceMocks.storeDispatchProposal,
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

function buildValidProposalInput() {
  return {
    intent: "dispatch_plan",
    customer: {
      status: "matched",
      matchedCustomerId: "11111111-1111-4111-8111-111111111111",
      matches: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Noah Thompson",
        },
      ],
    },
    jobDraft: {
      title: "Leaking tap repair",
      serviceAddress: "18 Collins Street, Melbourne VIC 3000",
      description: "Kitchen tap leaking under the sink.",
    },
    scheduleDraft: {
      scheduledStartAt: "2026-04-23T00:00:00.000Z",
      scheduledEndAt: "2026-04-23T02:00:00.000Z",
      timezone: "Australia/Adelaide",
    },
    assigneeDraft: {
      status: "matched",
      membershipId: "22222222-2222-4222-8222-222222222222",
      userId: "33333333-3333-4333-8333-333333333333",
      displayName: "Agent Staff",
    },
    warnings: [],
    confidence: 0.88,
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

  it("validates read tool input before calling services", async () => {
    const result = await executeTool(buildAuth(MembershipRole.MANAGER), "list_jobs", {
      customerId: "not-a-uuid",
    });

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        message: "Tool input validation failed.",
        details: expect.arrayContaining([
          expect.objectContaining({ path: "customerId" }),
        ]),
      }),
    );
    expect(serviceMocks.listJobs).not.toHaveBeenCalled();
  });

  it("saves a validated dispatch proposal", async () => {
    const input = buildValidProposalInput();
    const proposal = {
      id: "44444444-4444-4444-8444-444444444444",
      conversationId: "55555555-5555-4555-8555-555555555555",
      tenantId: "tenant-1",
      userId: "user-1",
      ...input,
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
    };
    serviceMocks.storeDispatchProposal.mockResolvedValueOnce(proposal);

    const result = await executeTool(
      buildAuth(MembershipRole.MANAGER),
      "save_dispatch_proposal",
      input,
      { conversationId: proposal.conversationId },
    );

    expect(serviceMocks.storeDispatchProposal).toHaveBeenCalledWith(
      buildAuth(MembershipRole.MANAGER),
      proposal.conversationId,
      {
        ...input,
        jobDraft: {
          title: input.jobDraft.title,
          serviceAddress: input.jobDraft.serviceAddress,
          description: input.jobDraft.description,
        },
      },
    );
    expect(result).toEqual({
      saved: true,
      proposalId: proposal.id,
      proposal,
    });
  });

  it("passes existing job IDs through dispatch proposals", async () => {
    const input = {
      ...buildValidProposalInput(),
      intent: "update_existing_job",
      jobDraft: {
        existingJobId: "66666666-6666-4666-8666-666666666666",
        title: "Leaking tap repair",
        serviceAddress: "18 Collins Street, Melbourne VIC 3000",
        description: "Existing work order.",
      },
    };
    const proposal = {
      id: "44444444-4444-4444-8444-444444444444",
      conversationId: "55555555-5555-4555-8555-555555555555",
      tenantId: "tenant-1",
      userId: "user-1",
      ...input,
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
    };
    serviceMocks.storeDispatchProposal.mockResolvedValueOnce(proposal);

    await executeTool(
      buildAuth(MembershipRole.MANAGER),
      "save_dispatch_proposal",
      input,
      { conversationId: proposal.conversationId },
    );

    expect(serviceMocks.storeDispatchProposal).toHaveBeenCalledWith(
      buildAuth(MembershipRole.MANAGER),
      proposal.conversationId,
      expect.objectContaining({
        intent: "update_existing_job",
        jobDraft: expect.objectContaining({
          existingJobId: "66666666-6666-4666-8666-666666666666",
        }),
      }),
    );
  });

  it("returns service error details so the agent can repair a proposal tool call", async () => {
    const input = buildValidProposalInput();
    serviceMocks.storeDispatchProposal.mockRejectedValueOnce(
      new ApiError(400, "Existing job ID is required.", {
        code: "EXISTING_JOB_REQUIRED",
        candidateJobs: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            title: "Leaking kitchen tap - Adelaide",
            status: "NEW",
          },
        ],
      }),
    );

    const result = await executeTool(
      buildAuth(MembershipRole.MANAGER),
      "save_dispatch_proposal",
      input,
      { conversationId: "55555555-5555-4555-8555-555555555555" },
    );

    expect(result).toEqual({
      error: true,
      message: "Existing job ID is required.",
      details: expect.objectContaining({
        code: "EXISTING_JOB_REQUIRED",
        candidateJobs: [
          expect.objectContaining({
            id: "66666666-6666-4666-8666-666666666666",
            title: "Leaking kitchen tap - Adelaide",
          }),
        ],
      }),
    });
  });

  it.each([
    {
      name: "out-of-range confidence",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.confidence = 1.4;
      },
      path: "confidence",
    },
    {
      name: "matched assignee without membershipId",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.assigneeDraft = {
          status: "matched",
          userId: "33333333-3333-4333-8333-333333333333",
          displayName: "Agent Staff",
        } as typeof input.assigneeDraft;
      },
      path: "assigneeDraft.membershipId",
    },
    {
      name: "invalid schedule window",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.scheduleDraft.scheduledEndAt = "2026-04-22T23:00:00.000Z";
      },
      path: "scheduleDraft.scheduledEndAt",
    },
    {
      name: "new customer without name",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.customer = { status: "new" } as typeof input.customer;
      },
      path: "customer.name",
    },
    {
      name: "ambiguous customer without enough matches",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.customer = {
          status: "ambiguous",
          matches: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Noah Thompson",
            },
          ],
        } as typeof input.customer;
      },
      path: "customer.matches",
    },
    {
      name: "new job without service address",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.jobDraft.serviceAddress = "";
      },
      path: "jobDraft.serviceAddress",
    },
    {
      name: "existing job update without job ID",
      mutate: (input: ReturnType<typeof buildValidProposalInput>) => {
        input.intent = "update_existing_job";
      },
      path: "jobDraft.existingJobId",
    },
  ])("rejects invalid dispatch proposal input: $name", async ({ mutate, path }) => {
    const input = buildValidProposalInput();
    mutate(input);

    const result = await executeTool(
      buildAuth(MembershipRole.MANAGER),
      "save_dispatch_proposal",
      input,
      { conversationId: "55555555-5555-4555-8555-555555555555" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        message: "Tool input validation failed.",
        details: expect.arrayContaining([
          expect.objectContaining({ path }),
        ]),
      }),
    );
    expect(serviceMocks.storeDispatchProposal).not.toHaveBeenCalled();
  });
});
