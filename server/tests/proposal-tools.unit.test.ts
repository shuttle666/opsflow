import { JobStatus, MembershipRole } from "@prisma/client";
import type { AuthContext } from "../src/types/auth";

const serviceMocks = vi.hoisted(() => ({
  getJobDetail: vi.fn(),
  getCustomerDetail: vi.fn(),
  getAssignableStaffMembership: vi.fn(),
  storeTypedProposal: vi.fn(),
  getProposalForExecution: vi.fn(),
  executeProposal: vi.fn(),
}));

vi.mock("../src/modules/job/job.service", () => ({
  listJobs: vi.fn(),
  getJobDetail: serviceMocks.getJobDetail,
  checkScheduleConflicts: vi.fn(),
}));
vi.mock("../src/modules/customer/customer.service", () => ({
  listCustomers: vi.fn(),
  getCustomerDetail: serviceMocks.getCustomerDetail,
}));
vi.mock("../src/modules/membership/membership.service", () => ({
  listMemberships: vi.fn(),
  getAssignableStaffMembership: serviceMocks.getAssignableStaffMembership,
}));
vi.mock("../src/modules/audit/audit.service", () => ({
  listActivityFeed: vi.fn(),
}));
vi.mock("../src/modules/agent/agent.service", () => ({
  storeTypedProposal: serviceMocks.storeTypedProposal,
  getProposalForExecution: serviceMocks.getProposalForExecution,
  executeProposal: serviceMocks.executeProposal,
  getProposalApprovalUrl: (conversationId: string, proposalId: string) =>
    `http://localhost:3000/agent?conversationId=${conversationId}&proposalId=${proposalId}`,
  getProposalApprovalPolicy: (proposal: { type?: string }) =>
    ["CREATE_JOB", "ASSIGN_JOB", "SCHEDULE_JOB"].includes(proposal.type ?? "")
      ? {
          approvalMode: "CONVERSATIONAL_OR_WEB",
          executionTool: "execute_proposal",
          confirmationPrompt: "Confirm in a new message.",
        }
      : {
          approvalMode: "WEB_ONLY",
          executionTool: null,
          confirmationPrompt: "Confirm in the Web app.",
        },
}));

import {
  proposeDispatchJob,
  proposeUpdateCustomer,
} from "../src/modules/operations-tools/proposal-builder";
import { proposalTools } from "../src/modules/operations-tools/definitions/proposal-tools";
import { proposalExecutionTools } from "../src/modules/operations-tools/definitions/proposal-execution-tools";
import { OpsFlowToolRegistry } from "../src/modules/operations-tools/tool-registry";

const auth: AuthContext = {
  userId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  role: MembershipRole.MANAGER,
};
const context = {
  source: "WEB_AGENT" as const,
  invocationId: "invocation-1",
  conversationId: "11111111-1111-4111-8111-111111111111",
};
const jobId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const membershipId = "44444444-4444-4444-8444-444444444444";

function buildJob() {
  return {
    id: jobId,
    title: "Dishwasher leak",
    serviceAddress: "8 Mount Barker Road",
    description: "Leak investigation",
    status: JobStatus.NEW,
    scheduledStartAt: null,
    scheduledEndAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: customerId,
      name: "Archie Wright",
      phone: null,
      email: null,
    },
    createdBy: {
      id: "user-1",
      displayName: "Manager",
      email: "manager@example.com",
    },
  };
}

function buildStoredProposal(type: string) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    conversationId: context.conversationId,
    tenantId: auth.tenantId,
    userId: auth.userId,
    type,
    intent: type.toLowerCase(),
    customer: { status: "matched" },
    jobDraft: { title: "Dishwasher leak" },
    scheduleDraft: { timezone: "Australia/Adelaide" },
    warnings: [],
    confidence: 1,
    review: { status: "READY", blockers: [], warnings: [] },
    createdAt: new Date(),
  };
}

describe("canonical proposal tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getJobDetail.mockResolvedValue(buildJob());
    serviceMocks.getAssignableStaffMembership.mockResolvedValue({
      membershipId,
      userId: "66666666-6666-4666-8666-666666666666",
      displayName: "Alex Nguyen",
    });
  });

  it("builds one verified proposal for assignment and scheduling", async () => {
    const proposal = buildStoredProposal("SCHEDULE_JOB");
    serviceMocks.storeTypedProposal.mockResolvedValueOnce(proposal);

    const result = await proposeDispatchJob(
      auth,
      {
        jobId,
        assigneeMembershipId: membershipId,
        schedule: {
          localDate: "2026-07-15",
          localStartTime: "09:00",
          localEndTime: "11:00",
          timezone: "Australia/Adelaide",
        },
      },
      context,
    );

    expect(serviceMocks.storeTypedProposal).toHaveBeenCalledWith(
      auth,
      context.conversationId,
      expect.objectContaining({
        type: "SCHEDULE_JOB",
        target: { customerId, jobId },
        jobDraft: expect.objectContaining({ existingJobId: jobId }),
        assigneeDraft: expect.objectContaining({
          membershipId,
          displayName: "Alex Nguyen",
        }),
        scheduleDraft: expect.objectContaining({
          scheduledStartAt: "2026-07-14T23:30:00.000Z",
          scheduledEndAt: "2026-07-15T01:30:00.000Z",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        saved: true,
        proposalId: proposal.id,
        approvalRequired: true,
        approvalMode: "CONVERSATIONAL_OR_WEB",
        executionTool: "execute_proposal",
        reviewStatus: "READY",
        proposal,
      }),
    );
  });

  it("derives customer change snapshots from current data", async () => {
    const customer = {
      id: customerId,
      name: "Archie Wright",
      phone: "0400 000 000",
      email: null,
      notes: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: {
        id: "user-1",
        displayName: "Manager",
        email: "manager@example.com",
      },
      jobs: [],
    };
    serviceMocks.getCustomerDetail.mockResolvedValue(customer);
    serviceMocks.storeTypedProposal.mockResolvedValueOnce(
      buildStoredProposal("UPDATE_CUSTOMER"),
    );

    await proposeUpdateCustomer(
      auth,
      { customerId, changes: { phone: "0412 999 888" } },
      context,
    );

    expect(serviceMocks.storeTypedProposal).toHaveBeenCalledWith(
      auth,
      context.conversationId,
      expect.objectContaining({
        type: "UPDATE_CUSTOMER",
        target: { customerId },
        changes: [
          { field: "phone", from: "0400 000 000", to: "0412 999 888" },
        ],
      }),
    );
  });

  it("exposes proposal creation, retrieval, and execution to MCP", () => {
    const registry = new OpsFlowToolRegistry();
    [...proposalTools, ...proposalExecutionTools].forEach((tool) =>
      registry.register(tool),
    );

    expect(
      registry
        .list({ auth, audience: "external-mcp" })
        .map((tool) => tool.name),
    ).toEqual([
      "propose_create_job",
      "propose_dispatch_job",
      "get_proposal",
      "execute_proposal",
    ]);
  });

  it("reads and executes proposals without requiring a new conversation context", async () => {
    const proposal = buildStoredProposal("CREATE_JOB");
    serviceMocks.getProposalForExecution.mockResolvedValueOnce({
      proposalId: proposal.id,
      conversationId: proposal.conversationId,
      status: "PENDING",
      proposal,
    });
    serviceMocks.executeProposal.mockResolvedValueOnce({
      executed: true,
      proposalId: proposal.id,
      conversationId: proposal.conversationId,
      status: "CONFIRMED",
      result: {
        proposalId: proposal.id,
        proposalType: "CREATE_JOB",
        entityType: "job",
        createdJobId: jobId,
        createdJobTitle: "Dishwasher leak",
      },
    });
    const registry = new OpsFlowToolRegistry();
    proposalExecutionTools.forEach((tool) => registry.register(tool));

    const fetched = await registry.execute({
      auth,
      audience: "external-mcp",
      toolName: "get_proposal",
      arguments: { proposalId: proposal.id },
      context: { source: "MCP", invocationId: "invocation-get" },
    });
    const executed = await registry.execute({
      auth,
      audience: "external-mcp",
      toolName: "execute_proposal",
      arguments: { proposalId: proposal.id, confirmationText: "  OK  " },
      context: { source: "MCP", invocationId: "invocation-execute" },
    });

    expect(fetched).toEqual(
      expect.objectContaining({
        proposalId: proposal.id,
        conversationId: proposal.conversationId,
        approvalMode: "CONVERSATIONAL_OR_WEB",
      }),
    );
    expect(serviceMocks.executeProposal).toHaveBeenCalledWith(auth, proposal.id, {
      source: "MCP",
      confirmationText: "  OK  ",
      appendReceiptMessage: false,
    });
    expect(executed).toEqual(expect.objectContaining({ executed: true }));
  });

  it("rejects proposal creation without a conversation context", async () => {
    const registry = new OpsFlowToolRegistry();
    proposalTools.forEach((tool) => registry.register(tool));

    const result = await registry.execute({
      auth,
      audience: "web-agent",
      toolName: "propose_dispatch_job",
      arguments: { jobId, assigneeMembershipId: membershipId },
      context: { source: "WEB_AGENT", invocationId: "invocation-2" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        code: "TOOL_CONVERSATION_REQUIRED",
      }),
    );
  });
});
