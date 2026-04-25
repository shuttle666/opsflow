import type Anthropic from "@anthropic-ai/sdk";
import {
  AgentProposalStatus,
  JobStatus,
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import type { AuthContext } from "../src/types/auth";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  addUserMessage,
  appendAssistantMessage,
  confirmDispatchProposal,
  createConversation,
  getConversation,
  listConversations,
  storeDispatchProposal,
  storeTypedProposal,
  updateProposalReview,
} from "../src/modules/agent/agent.service";
import { resolveJobTarget } from "../src/modules/agent/target-resolvers";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("agent persistence integration", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  async function seedTenantUser(input: {
    email: string;
    displayName: string;
    role: MembershipRole;
    tenantName: string;
    tenantSlug: string;
  }) {
    const passwordHash = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      }),
      prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      }),
    ]);

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: input.role,
        status: MembershipStatus.ACTIVE,
      },
    });

    return {
      tenant,
      user,
      membership,
      auth: {
        userId: user.id,
        sessionId: `${user.id}-session`,
        tenantId: tenant.id,
        role: input.role,
      } satisfies AuthContext,
    };
  }

  it("persists conversation messages, tool calls, proposal, and confirmation state", async () => {
    const owner = await seedTenantUser({
      email: "owner@agent-persistence.test",
      displayName: "Agent Owner",
      role: MembershipRole.OWNER,
      tenantName: "Agent Persistence Tenant",
      tenantSlug: "agent-persistence-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const staff = await prisma.user.create({
      data: {
        email: "staff@agent-persistence.test",
        passwordHash,
        displayName: "Agent Staff",
      },
    });
    const staffMembership = await prisma.membership.create({
      data: {
        userId: staff.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Noah Thompson",
      },
    });

    const conversation = await createConversation(owner.auth);
    await addUserMessage(
      owner.auth,
      conversation.id,
      "Create a leaking tap job for Noah tomorrow morning.",
    );

    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "dispatch_plan",
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
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
        membershipId: staffMembership.id,
        userId: staff.id,
        displayName: staff.displayName,
      },
      warnings: [],
      confidence: 0.88,
    });

    const modelMessages = [
      { role: "user", content: "Create a leaking tap job for Noah tomorrow morning." },
      { role: "assistant", content: "Drafted a dispatch plan." },
    ] satisfies Anthropic.MessageParam[];

    await appendAssistantMessage(conversation.id, "Drafted a dispatch plan.", modelMessages, [
      {
        name: "check_schedule_conflicts",
        input: {
          assigneeUserId: staff.id,
          scheduledStartAt: "2026-04-23T00:00:00.000Z",
          scheduledEndAt: "2026-04-23T02:00:00.000Z",
        },
        result: {
          hasConflict: false,
          conflicts: [],
        },
      },
      {
        name: "save_dispatch_proposal",
        input: {
          intent: "dispatch_plan",
        },
        result: {
          proposal,
        },
      },
    ]);

    const summaries = await listConversations(owner.auth);
    expect(summaries[0]?.preview).toBe(
      "Create a leaking tap job for Noah tomorrow morning.",
    );

    const persisted = await getConversation(owner.auth, conversation.id);
    expect(persisted?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(persisted?.messages[1]?.toolCalls).toEqual([
      expect.objectContaining({
        name: "check_schedule_conflicts",
        input: expect.objectContaining({ assigneeUserId: staff.id }),
        result: { hasConflict: false, conflicts: [] },
      }),
      expect.objectContaining({
        name: "save_dispatch_proposal",
        result: expect.objectContaining({
          proposal: expect.objectContaining({ id: proposal.id }),
        }),
      }),
    ]);
    expect(persisted?.messages[1]?.proposal?.id).toBe(proposal.id);

    const pendingProposal = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(pendingProposal.status).toBe(AgentProposalStatus.PENDING);
    expect(pendingProposal.assistantMessageId).toBeTruthy();

    const result = await confirmDispatchProposal(
      owner.auth,
      conversation.id,
      proposal.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        entityType: "job",
        createdJobTitle: "Leaking tap repair",
        assignedToName: staff.displayName,
        transitionedTo: JobStatus.SCHEDULED,
      }),
    );

    const confirmedProposal = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(confirmedProposal.status).toBe(AgentProposalStatus.CONFIRMED);
    expect(confirmedProposal.confirmedById).toBe(owner.user.id);
    expect(confirmedProposal.confirmationResult).toEqual(
      expect.objectContaining({
        proposalId: proposal.id,
        entityType: "job",
      }),
    );

    const createdJob = await prisma.job.findUniqueOrThrow({
      where: { id: result.createdJobId },
    });
    expect(createdJob.status).toBe(JobStatus.SCHEDULED);
    expect(createdJob.assignedToId).toBe(staff.id);

    const afterConfirm = await getConversation(owner.auth, conversation.id);
    expect(afterConfirm?.messages.some((message) => message.proposal)).toBe(false);
  });

  it("updates an existing job instead of creating a duplicate when proposal includes existingJobId", async () => {
    const owner = await seedTenantUser({
      email: "owner-existing-job@agent-persistence.test",
      displayName: "Existing Job Owner",
      role: MembershipRole.OWNER,
      tenantName: "Existing Job Tenant",
      tenantSlug: "existing-job-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const staff = await prisma.user.create({
      data: {
        email: "staff-existing-job@agent-persistence.test",
        passwordHash,
        displayName: "Existing Job Staff",
      },
    });
    const staffMembership = await prisma.membership.create({
      data: {
        userId: staff.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Archie Wright",
      },
    });
    const existingJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Dishwasher leak investigation - Stirling",
        serviceAddress: "42 Queensbridge Street, Southbank VIC 3006",
        description: "Dishwasher leaks after long cycle.",
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "update_existing_job",
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        existingJobId: existingJob.id,
        title: existingJob.title,
        description: existingJob.description,
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: staffMembership.id,
        userId: staff.id,
        displayName: staff.displayName,
      },
      warnings: [],
      confidence: 0.9,
    });

    const result = await confirmDispatchProposal(
      owner.auth,
      conversation.id,
      proposal.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        entityType: "job",
        createdJobId: existingJob.id,
        updatedExistingJob: true,
        assignedToName: staff.displayName,
        transitionedTo: JobStatus.SCHEDULED,
      }),
    );

    const jobs = await prisma.job.findMany({
      where: {
        tenantId: owner.tenant.id,
        title: existingJob.title,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        id: existingJob.id,
        status: JobStatus.SCHEDULED,
        assignedToId: staff.id,
      }),
    );
    expect(jobs[0]?.scheduledStartAt?.toISOString()).toBe("2026-04-23T00:00:00.000Z");
    expect(jobs[0]?.scheduledEndAt?.toISOString()).toBe("2026-04-23T02:00:00.000Z");
  });

  it("confirms a typed customer update proposal without creating jobs", async () => {
    const owner = await seedTenantUser({
      email: "owner-typed-customer-update@agent-persistence.test",
      displayName: "Typed Customer Owner",
      role: MembershipRole.OWNER,
      tenantName: "Typed Customer Update Tenant",
      tenantSlug: "typed-customer-update-tenant",
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Mia Carter",
        phone: "0412 000 100",
        email: "mia.old@example.test",
        notes: "Prefers morning appointments.",
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "UPDATE_CUSTOMER",
      target: {
        customerId: customer.id,
      },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      changes: [
        {
          field: "phone",
          from: "0412 000 100",
          to: "0412 999 888",
        },
        {
          field: "email",
          from: "mia.old@example.test",
          to: "mia.new@example.test",
        },
      ],
      warnings: [],
      confidence: 0.93,
    });

    const result = await confirmDispatchProposal(
      owner.auth,
      conversation.id,
      proposal.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        proposalType: "UPDATE_CUSTOMER",
        entityType: "customer",
        updatedCustomerId: customer.id,
        updatedCustomerName: customer.name,
      }),
    );

    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated).toEqual(
      expect.objectContaining({
        name: "Mia Carter",
        phone: "0412 999 888",
        email: "mia.new@example.test",
        notes: "Prefers morning appointments.",
      }),
    );
    await expect(
      prisma.job.count({
        where: { tenantId: owner.tenant.id },
      }),
    ).resolves.toBe(0);
  });

  it("confirms a typed create job proposal with serviceAddress", async () => {
    const owner = await seedTenantUser({
      email: "owner-typed-create-job@agent-persistence.test",
      displayName: "Typed Create Job Owner",
      role: MembershipRole.OWNER,
      tenantName: "Typed Create Job Tenant",
      tenantSlug: "typed-create-job-tenant",
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Leo Martin",
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "CREATE_JOB",
      target: {
        customerId: customer.id,
      },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        title: "Air conditioner maintenance - Glenelg",
        serviceAddress: "12 Jetty Road, Glenelg SA 5045",
        description: "Seasonal maintenance before summer.",
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 0.87,
    });

    const result = await confirmDispatchProposal(
      owner.auth,
      conversation.id,
      proposal.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        proposalType: "CREATE_JOB",
        entityType: "job",
        createdCustomerId: customer.id,
        createdJobTitle: "Air conditioner maintenance - Glenelg",
      }),
    );

    const job = await prisma.job.findUniqueOrThrow({
      where: { id: result.createdJobId },
    });
    expect(job).toEqual(
      expect.objectContaining({
        customerId: customer.id,
        title: "Air conditioner maintenance - Glenelg",
        serviceAddress: "12 Jetty Road, Glenelg SA 5045",
        status: JobStatus.NEW,
      }),
    );
  });

  it("confirms a typed update job proposal against the existing job only", async () => {
    const owner = await seedTenantUser({
      email: "owner-typed-update-job@agent-persistence.test",
      displayName: "Typed Update Job Owner",
      role: MembershipRole.OWNER,
      tenantName: "Typed Update Job Tenant",
      tenantSlug: "typed-update-job-tenant",
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Archie Wright",
      },
    });
    const existingJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Dishwasher leak investigation - Stirling",
        serviceAddress: "8 Mount Barker Road, Stirling SA 5152",
        description: "Original description.",
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "UPDATE_JOB",
      target: {
        customerId: customer.id,
        jobId: existingJob.id,
      },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        existingJobId: existingJob.id,
        title: "Dishwasher leak investigation - Stirling",
        serviceAddress: "10 Mount Barker Road, Stirling SA 5152",
        description: "Updated access note: side gate is open.",
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 0.91,
    });

    const result = await confirmDispatchProposal(
      owner.auth,
      conversation.id,
      proposal.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        proposalType: "UPDATE_JOB",
        entityType: "job",
        createdJobId: existingJob.id,
        updatedExistingJob: true,
      }),
    );

    const jobs = await prisma.job.findMany({
      where: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        id: existingJob.id,
        serviceAddress: "10 Mount Barker Road, Stirling SA 5152",
        description: "Updated access note: side gate is open.",
      }),
    );
  });

  it("resolves an existing customer job from a natural full sentence", async () => {
    const owner = await seedTenantUser({
      email: "owner-resolve-existing-job@agent-persistence.test",
      displayName: "Resolve Existing Job Owner",
      role: MembershipRole.OWNER,
      tenantName: "Resolve Existing Job Tenant",
      tenantSlug: "resolve-existing-job-tenant",
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Leo Martin",
      },
    });
    const existingJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Leaking kitchen tap - Adelaide",
        serviceAddress: "36 Greenhill Rd, Port Adelaide SA",
        description: "Kitchen tap leaking under the sink.",
      },
    });

    const resolved = await resolveJobTarget(owner.auth, {
      customerId: customer.id,
      q: "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee",
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        status: "matched",
        job: expect.objectContaining({
          id: existingJob.id,
          serviceAddress: "36 Greenhill Rd, Port Adelaide SA",
        }),
      }),
    );
  });

  it("rolls back typed schedule changes when assignment fails", async () => {
    const owner = await seedTenantUser({
      email: "owner-typed-schedule-rollback@agent-persistence.test",
      displayName: "Typed Schedule Rollback Owner",
      role: MembershipRole.OWNER,
      tenantName: "Typed Schedule Rollback Tenant",
      tenantSlug: "typed-schedule-rollback-tenant",
    });
    const passwordHash = await hashPassword("password123");
    const [disabledStaff, customer] = await Promise.all([
      prisma.user.create({
        data: {
          email: "disabled-typed-schedule@agent-persistence.test",
          passwordHash,
          displayName: "Disabled Typed Staff",
        },
      }),
      prisma.customer.create({
        data: {
          tenantId: owner.tenant.id,
          createdById: owner.user.id,
          name: "Noah Thompson",
        },
      }),
    ]);
    const [disabledMembership, existingJob] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: disabledStaff.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.DISABLED,
        },
      }),
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          createdById: owner.user.id,
          title: "Ceiling fan installation - Henley Beach",
          serviceAddress: "20 Seaview Road, Henley Beach SA 5022",
          description: "Install customer supplied fan.",
        },
      }),
    ]);

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "SCHEDULE_JOB",
      target: {
        customerId: customer.id,
        jobId: existingJob.id,
      },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        existingJobId: existingJob.id,
        title: existingJob.title,
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: disabledMembership.id,
        userId: disabledStaff.id,
        displayName: disabledStaff.displayName,
      },
      warnings: [],
      confidence: 0.76,
    });

    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("No customer or job was created or updated");

    const jobAfterFailure = await prisma.job.findUniqueOrThrow({
      where: { id: existingJob.id },
    });
    expect(jobAfterFailure).toEqual(
      expect.objectContaining({
        status: JobStatus.NEW,
        assignedToId: null,
        scheduledAt: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
      }),
    );
  });

  it("saves duplicate-looking new job proposals for review and lets the user select the existing job", async () => {
    const owner = await seedTenantUser({
      email: "owner-existing-required@agent-persistence.test",
      displayName: "Existing Required Owner",
      role: MembershipRole.OWNER,
      tenantName: "Existing Required Tenant",
      tenantSlug: "existing-required-tenant",
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Leo Martin",
        phone: "0412 001 781",
      },
    });
    const existingJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Leaking kitchen tap - Adelaide",
        serviceAddress: "7 Bourke Street, Docklands VIC 3008",
        description: "Kitchen tap is leaking under the sink.",
      },
    });

    const conversation = await createConversation(owner.auth);

    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "dispatch_plan",
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        title: "厨房水龙头漏水维修",
        serviceAddress: "63 Rathdowne Street, Carlton VIC 3053",
        description: "安排 Harper Lee 上门维修。",
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T04:30:00.000Z",
        scheduledEndAt: "2026-04-23T06:30:00.000Z",
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 0.82,
    });

    expect(proposal.review).toEqual(
      expect.objectContaining({
        status: "NEEDS_RESOLUTION",
        candidates: expect.objectContaining({
          jobs: [
            expect.objectContaining({
              id: existingJob.id,
              title: existingJob.title,
            }),
          ],
        }),
      }),
    );
    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toMatchObject({
      message: expect.stringContaining("existing job"),
      details: expect.objectContaining({
        code: "PROPOSAL_REVIEW_REQUIRED",
      }),
    });

    const reviewed = await updateProposalReview(owner.auth, conversation.id, proposal.id, {
      jobId: existingJob.id,
    });
    expect(reviewed.jobDraft.existingJobId).toBe(existingJob.id);
    expect(reviewed.review?.status).toBe("READY");

    const result = await confirmDispatchProposal(owner.auth, conversation.id, proposal.id);
    expect(result).toEqual(
      expect.objectContaining({
        createdJobId: existingJob.id,
        updatedExistingJob: true,
      }),
    );

    await expect(
      prisma.agentProposal.count({
        where: {
          conversationId: conversation.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it("persists resolver job candidates from unresolved typed proposals", async () => {
    const owner = await seedTenantUser({
      email: "owner-typed-candidates@agent-persistence.test",
      displayName: "Typed Candidates Owner",
      role: MembershipRole.OWNER,
      tenantName: "Typed Candidates Tenant",
      tenantSlug: "typed-candidates-tenant",
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Mia Chen",
        phone: "0412 009 120",
      },
    });
    const firstJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Aircon maintenance - Glenelg",
        serviceAddress: "12 Jetty Road, Glenelg SA 5045",
        description: "Seasonal air conditioner maintenance.",
      },
    });
    const secondJob = await prisma.job.create({
      data: {
        tenantId: owner.tenant.id,
        customerId: customer.id,
        createdById: owner.user.id,
        title: "Aircon service - Glenelg",
        serviceAddress: "14 Jetty Road, Glenelg SA 5045",
        description: "Air conditioner service request.",
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "SCHEDULE_JOB",
      customer: {
        status: "missing",
        query: "aircon maintenance",
      },
      jobDraft: {
        title: "Aircon maintenance",
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T04:30:00.000Z",
        scheduledEndAt: "2026-04-23T06:30:00.000Z",
        timezone: "Australia/Adelaide",
      },
      review: {
        candidates: {
          jobs: [
            {
              id: firstJob.id,
              title: firstJob.title,
              serviceAddress: firstJob.serviceAddress,
              status: firstJob.status,
              scheduledStartAt: null,
              scheduledEndAt: null,
              assignedToName: null,
              customer: {
                id: customer.id,
                name: customer.name,
              },
            },
            {
              id: secondJob.id,
              title: secondJob.title,
              serviceAddress: secondJob.serviceAddress,
              status: secondJob.status,
              scheduledStartAt: null,
              scheduledEndAt: null,
              assignedToName: null,
              customer: {
                id: customer.id,
                name: customer.name,
              },
            },
          ],
        },
      },
      warnings: [],
      confidence: 0.68,
    });

    expect(proposal.review).toEqual(
      expect.objectContaining({
        status: "NEEDS_RESOLUTION",
        candidates: expect.objectContaining({
          jobs: [
            expect.objectContaining({
              id: firstJob.id,
              title: firstJob.title,
            }),
            expect.objectContaining({
              id: secondJob.id,
              title: secondJob.title,
            }),
          ],
        }),
      }),
    );
    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: "PROPOSAL_REVIEW_REQUIRED",
      }),
    });

    const reviewed = await updateProposalReview(owner.auth, conversation.id, proposal.id, {
      jobId: firstJob.id,
    });
    expect(reviewed.target?.jobId).toBe(firstJob.id);
    expect(reviewed.target?.customerId).toBe(customer.id);
    expect(reviewed.review?.status).toBe("READY");
  });

  it("rolls back new customer and job creation when proposal assignment fails", async () => {
    const owner = await seedTenantUser({
      email: "owner-rollback-new@agent-persistence.test",
      displayName: "Rollback New Owner",
      role: MembershipRole.OWNER,
      tenantName: "Rollback New Tenant",
      tenantSlug: "rollback-new-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const disabledStaff = await prisma.user.create({
      data: {
        email: "disabled-rollback-new@agent-persistence.test",
        passwordHash,
        displayName: "Disabled Rollback Staff",
      },
    });
    const disabledMembership = await prisma.membership.create({
      data: {
        userId: disabledStaff.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.DISABLED,
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "dispatch_plan",
      customer: {
        status: "new",
        name: "Rollback Customer",
      },
      jobDraft: {
        title: "Rollback job",
        serviceAddress: "25 Gertrude Street, Fitzroy VIC 3065",
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: disabledMembership.id,
        userId: disabledStaff.id,
        displayName: disabledStaff.displayName,
      },
      warnings: [],
      confidence: 0.71,
    });

    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("No customer or job was created");

    await expect(
      prisma.customer.findFirst({
        where: {
          tenantId: owner.tenant.id,
          name: "Rollback Customer",
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.job.findFirst({
        where: {
          tenantId: owner.tenant.id,
          title: "Rollback job",
        },
      }),
    ).resolves.toBeNull();

    const failedProposal = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(failedProposal.status).toBe(AgentProposalStatus.FAILED);
    expect(failedProposal.failureMessage).toContain("No customer or job was created");
    expect(failedProposal.confirmationResult).toEqual(
      expect.objectContaining({
        error: true,
        message: expect.stringContaining("No customer or job was created"),
      }),
    );
  });

  it("does not create a job for an existing customer when proposal assignment fails", async () => {
    const owner = await seedTenantUser({
      email: "owner-rollback-existing@agent-persistence.test",
      displayName: "Rollback Existing Owner",
      role: MembershipRole.OWNER,
      tenantName: "Rollback Existing Tenant",
      tenantSlug: "rollback-existing-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [disabledStaff, customer] = await Promise.all([
      prisma.user.create({
        data: {
          email: "disabled-rollback-existing@agent-persistence.test",
          passwordHash,
          displayName: "Disabled Existing Staff",
        },
      }),
      prisma.customer.create({
        data: {
          tenantId: owner.tenant.id,
          createdById: owner.user.id,
          name: "Existing Rollback Customer",
        },
      }),
    ]);
    const disabledMembership = await prisma.membership.create({
      data: {
        userId: disabledStaff.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.DISABLED,
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "dispatch_plan",
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        title: "Existing rollback job",
        serviceAddress: "89 Smith Street, Collingwood VIC 3066",
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: disabledMembership.id,
        userId: disabledStaff.id,
        displayName: disabledStaff.displayName,
      },
      warnings: [],
      confidence: 0.72,
    });

    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("No customer or job was created");

    await expect(
      prisma.customer.findUnique({
        where: { id: customer.id },
      }),
    ).resolves.toEqual(expect.objectContaining({ id: customer.id }));
    await expect(
      prisma.job.findFirst({
        where: {
          tenantId: owner.tenant.id,
          title: "Existing rollback job",
        },
      }),
    ).resolves.toBeNull();

    const failedProposal = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(failedProposal.status).toBe(AgentProposalStatus.FAILED);
  });

  it("rolls back customer, job, and assignment when proposal status transition fails", async () => {
    const owner = await seedTenantUser({
      email: "owner-rollback-status@agent-persistence.test",
      displayName: "Rollback Status Owner",
      role: MembershipRole.OWNER,
      tenantName: "Rollback Status Tenant",
      tenantSlug: "rollback-status-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const staff = await prisma.user.create({
      data: {
        email: "staff-rollback-status@agent-persistence.test",
        passwordHash,
        displayName: "Rollback Status Staff",
      },
    });
    const staffMembership = await prisma.membership.create({
      data: {
        userId: staff.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "dispatch_plan",
      customer: {
        status: "new",
        name: "Status Rollback Customer",
      },
      jobDraft: {
        title: "Status rollback job",
        serviceAddress: "31 Swan Street, Richmond VIC 3121",
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "matched",
        membershipId: staffMembership.id,
        userId: staff.id,
        displayName: staff.displayName,
      },
      warnings: [],
      confidence: 0.73,
    });

    await prisma.tenant.update({
      where: { id: owner.tenant.id },
      data: { status: TenantStatus.DEACTIVATED },
    });

    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("No customer or job was created");

    await expect(
      prisma.customer.findFirst({
        where: {
          tenantId: owner.tenant.id,
          name: "Status Rollback Customer",
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.job.findFirst({
        where: {
          tenantId: owner.tenant.id,
          title: "Status rollback job",
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.notification.findFirst({
        where: {
          tenantId: owner.tenant.id,
          recipientUserId: staff.id,
        },
      }),
    ).resolves.toBeNull();

    const failedProposal = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(failedProposal.status).toBe(AgentProposalStatus.FAILED);
  });

  it("keeps agent conversations and proposals isolated by user and tenant", async () => {
    const owner = await seedTenantUser({
      email: "owner-isolated@agent-persistence.test",
      displayName: "Isolated Owner",
      role: MembershipRole.OWNER,
      tenantName: "Agent Isolation Tenant",
      tenantSlug: "agent-isolation-tenant",
    });
    const otherOwner = await seedTenantUser({
      email: "other-isolated@agent-persistence.test",
      displayName: "Other Owner",
      role: MembershipRole.OWNER,
      tenantName: "Other Agent Isolation Tenant",
      tenantSlug: "other-agent-isolation-tenant",
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "create_customer",
      customer: {
        status: "new",
        name: "Cross Tenant Customer",
      },
      jobDraft: {
        title: "Customer record only",
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 0.7,
    });

    await expect(getConversation(otherOwner.auth, conversation.id)).resolves.toBeNull();
    await expect(
      confirmDispatchProposal(otherOwner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("Proposal not found.");
  });

  it("requires ambiguous staff proposals to be resolved before confirmation", async () => {
    const owner = await seedTenantUser({
      email: "owner-review-staff@agent-persistence.test",
      displayName: "Review Staff Owner",
      role: MembershipRole.OWNER,
      tenantName: "Review Staff Tenant",
      tenantSlug: "review-staff-tenant",
    });
    const passwordHash = await hashPassword("password123");
    const [customer, staffA, staffB] = await Promise.all([
      prisma.customer.create({
        data: {
          tenantId: owner.tenant.id,
          createdById: owner.user.id,
          name: "Archie Wright",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-a-review@agent-persistence.test",
          passwordHash,
          displayName: "Alex Nguyen",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff-b-review@agent-persistence.test",
          passwordHash,
          displayName: "Alex N.",
        },
      }),
    ]);
    const [membershipA, membershipB, existingJob] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: staffA.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: staffB.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.job.create({
        data: {
          tenantId: owner.tenant.id,
          customerId: customer.id,
          createdById: owner.user.id,
          title: "Dishwasher leak investigation - Stirling",
          serviceAddress: "8 Mount Barker Road, Stirling SA 5152",
        },
      }),
    ]);

    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "SCHEDULE_JOB",
      target: {
        customerId: customer.id,
        jobId: existingJob.id,
      },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        existingJobId: existingJob.id,
        title: existingJob.title,
      },
      scheduleDraft: {
        scheduledStartAt: "2026-04-23T00:00:00.000Z",
        scheduledEndAt: "2026-04-23T02:00:00.000Z",
        timezone: "Australia/Adelaide",
      },
      assigneeDraft: {
        status: "ambiguous",
        matches: [
          {
            membershipId: membershipA.id,
            userId: staffA.id,
            displayName: staffA.displayName,
          },
          {
            membershipId: membershipB.id,
            userId: staffB.id,
            displayName: staffB.displayName,
          },
        ],
      },
      warnings: [],
      confidence: 0.74,
    });

    expect(proposal.review?.status).toBe("NEEDS_RESOLUTION");
    expect(proposal.review?.candidates?.staff).toHaveLength(2);
    await expect(
      confirmDispatchProposal(owner.auth, conversation.id, proposal.id),
    ).rejects.toThrow("Select the staff member");

    const reviewed = await updateProposalReview(owner.auth, conversation.id, proposal.id, {
      membershipId: membershipA.id,
    });
    expect(reviewed.assigneeDraft).toEqual(
      expect.objectContaining({
        status: "matched",
        membershipId: membershipA.id,
      }),
    );
    expect(reviewed.review?.status).toBe("READY");
  });

  it("rejects staff confirmation before resolving a persisted proposal", async () => {
    const owner = await seedTenantUser({
      email: "owner-staff-confirm@agent-persistence.test",
      displayName: "Staff Confirm Owner",
      role: MembershipRole.OWNER,
      tenantName: "Staff Confirm Tenant",
      tenantSlug: "staff-confirm-tenant",
    });
    const staff = await seedTenantUser({
      email: "staff-confirm@agent-persistence.test",
      displayName: "Staff Confirm User",
      role: MembershipRole.STAFF,
      tenantName: "Staff Confirm Other Tenant",
      tenantSlug: "staff-confirm-other-tenant",
    });

    const conversation = await createConversation(owner.auth);
    const proposal = await storeDispatchProposal(owner.auth, conversation.id, {
      intent: "create_customer",
      customer: {
        status: "new",
        name: "Staff Blocked Customer",
      },
      jobDraft: {
        title: "Customer record only",
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 0.7,
    });

    await expect(
      confirmDispatchProposal(staff.auth, conversation.id, proposal.id),
    ).rejects.toThrow("Only owners and managers can confirm dispatch plans.");

    await expect(
      updateProposalReview(staff.auth, conversation.id, proposal.id, {
        customerId: owner.user.id,
      }),
    ).rejects.toThrow("Only owners and managers can update dispatch plans.");

    const stillPending = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(stillPending.status).toBe(AgentProposalStatus.PENDING);
  });
});
