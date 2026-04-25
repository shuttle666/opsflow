import { AgentProposalStatus, JobStatus } from "@prisma/client";
import {
  addUserMessage,
  appendAssistantMessage,
  confirmDispatchProposal,
  createConversation,
  getConversation,
  storeTypedProposal,
} from "../agent/agent.service";
import { classifyAgentIntent } from "../agent/intent-router";
import { saveTypedProposalToolInputSchema } from "../agent/agent-schemas";
import {
  resolveCustomerTarget,
  resolveJobTarget,
  resolveStaffTarget,
  resolveTimeWindow,
} from "../agent/target-resolvers";
import { runAgentLoop } from "../agent/agent-loop";
import { checkScheduleConflicts } from "../job/job.service";
import { prisma } from "../../lib/prisma";
import type { AgentEvalWorkspace } from "./workspace";
import {
  expectEqual,
  expectTruthy,
  fail,
  pass,
  resultFromAssertions,
  type AiEvalAssertion,
  type AiEvalResult,
} from "./types";

type AgentEvalCase = {
  name: string;
  prompt: string;
  runCheap: (workspace: AgentEvalWorkspace) => Promise<AiEvalResult>;
  runLlm?: (workspace: AgentEvalWorkspace) => Promise<AiEvalResult>;
};

const timezone = "Australia/Adelaide";
const startAt = "2026-04-23T00:00:00.000Z";
const endAt = "2026-04-23T02:00:00.000Z";

function parsedProposalAssertion(input: unknown): {
  assertion: AiEvalAssertion;
  data?: ReturnType<typeof saveTypedProposalToolInputSchema.parse>;
} {
  const parsed = saveTypedProposalToolInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      assertion: fail("typed proposal schema accepts payload", {
        expected: "valid typed proposal payload",
        actual: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    };
  }

  return {
    assertion: pass("typed proposal schema accepts payload"),
    data: parsed.data,
  };
}

async function countJobs(tenantId: string) {
  return prisma.job.count({ where: { tenantId } });
}

async function countProposals(conversationId: string) {
  return prisma.agentProposal.count({ where: { conversationId } });
}

function llmResultAssertions(input: {
  name: string;
  prompt: string;
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
  proposal?: {
    type?: string;
    jobDraft?: {
      existingJobId?: string;
      title?: string;
    };
  };
  expectedProposalType?: string;
  mustUseExistingJob?: boolean;
}) {
  const assertions: AiEvalAssertion[] = [
    expectTruthy(
      "LLM called at least one resolver",
      input.toolCalls.some((toolCall) => toolCall.name.startsWith("resolve_")),
      { toolNames: input.toolCalls.map((toolCall) => toolCall.name) },
    ),
    expectTruthy("LLM saved a proposal", input.proposal),
  ];

  if (input.expectedProposalType) {
    assertions.push(
      expectEqual(
        "LLM proposal type",
        input.proposal?.type,
        input.expectedProposalType,
      ),
    );
  }

  if (input.mustUseExistingJob) {
    assertions.push(
      expectTruthy(
        "LLM proposal targets an existing job",
        input.proposal?.jobDraft?.existingJobId,
        { proposal: input.proposal },
      ),
    );
  }

  return resultFromAssertions({
    name: input.name,
    prompt: input.prompt,
    mode: "llm",
    assertions,
    summary: {
      toolNames: input.toolCalls.map((toolCall) => toolCall.name),
      proposalType: input.proposal?.type,
      existingJobId: input.proposal?.jobDraft?.existingJobId,
    },
  });
}

async function runLlmPlannerEval(
  workspace: AgentEvalWorkspace,
  input: {
    name: string;
    prompt: string;
    expectedProposalType?: string;
    mustUseExistingJob?: boolean;
  },
) {
  const conversation = await createConversation(workspace.auth);
  await addUserMessage(workspace.auth, conversation.id, input.prompt);
  const updatedConversation = await getConversation(workspace.auth, conversation.id);

  if (!updatedConversation) {
    return resultFromAssertions({
      name: input.name,
      prompt: input.prompt,
      mode: "llm",
      assertions: [fail("conversation reloads before LLM run")],
    });
  }

  const result = await runAgentLoop(
    updatedConversation.claudeMessages,
    workspace.auth,
    {
      conversationId: conversation.id,
      timezone,
    },
    {
      onTextDelta: () => undefined,
      onToolUse: () => undefined,
      onToolResult: () => undefined,
      onProposal: () => undefined,
    },
  );

  await appendAssistantMessage(
    conversation.id,
    result.fullText,
    result.messages,
    result.toolCalls,
  );

  return llmResultAssertions({
    ...input,
    toolCalls: result.toolCalls,
    proposal: result.proposal,
  });
}

export const agentEvalCases: AgentEvalCase[] = [
  {
    name: "existing dishwasher job schedule uses existing job",
    prompt: "把 Archie Wright 的洗碗机漏水工单分配给 Alex Nguyen 明天 9 点",
    runCheap: async (workspace) => {
      const staff = await workspace.createStaff({ displayName: "Alex Nguyen" });
      const customer = await workspace.createCustomer({ name: "Archie Wright" });
      const existingJob = await workspace.createJob({
        customerId: customer.id,
        title: "Dishwasher leak investigation - Stirling",
        serviceAddress: "8 Mount Barker Road, Stirling SA 5152",
        description: "洗碗机在长周期运行后底部出现积水。",
      });
      const jobCountBefore = await countJobs(workspace.tenant.id);
      const intent = classifyAgentIntent(
        "把 Archie Wright 的洗碗机漏水工单分配给 Alex Nguyen 明天 9 点",
      );
      const customerResolution = await resolveCustomerTarget(workspace.auth, {
        name: "Archie Wright",
      });
      const jobResolution = await resolveJobTarget(workspace.auth, {
        customerId: customer.id,
        q: "把 Archie Wright 的洗碗机漏水工单分配给 Alex Nguyen 明天 9 点",
      });
      const staffResolution = await resolveStaffTarget(workspace.auth, {
        q: "Alex Nguyen",
      });
      const timeResolution = resolveTimeWindow({
        scheduledStartAt: startAt,
        scheduledEndAt: endAt,
        timezone,
      });
      const missingJobIdSchemaResult = saveTypedProposalToolInputSchema.safeParse({
        type: "SCHEDULE_JOB",
        target: {
          customerId: customer.id,
        },
        customer: {
          status: "matched",
          matchedCustomerId: customer.id,
          matches: [{ id: customer.id, name: customer.name }],
        },
        jobDraft: {
          title: existingJob.title,
        },
        scheduleDraft: {
          scheduledStartAt: startAt,
          scheduledEndAt: endAt,
          timezone,
        },
        assigneeDraft: {
          status: "matched",
          membershipId: staff.membership.id,
          userId: staff.user.id,
          displayName: staff.user.displayName,
        },
        warnings: [],
        confidence: 0.9,
      });
      const parsed = parsedProposalAssertion({
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
          scheduledStartAt: startAt,
          scheduledEndAt: endAt,
          timezone,
        },
        assigneeDraft: {
          status: "matched",
          membershipId: staff.membership.id,
          userId: staff.user.id,
          displayName: staff.user.displayName,
        },
        warnings: [],
        confidence: 0.9,
      });
      const conversation = await createConversation(workspace.auth);
      let unresolvedReviewStatus: string | undefined;
      let unresolvedCandidateJobId: string | undefined;
      let unresolvedConfirmErrorCode: string | undefined;
      let proposalId: string | undefined;
      let confirmResult:
        | Awaited<ReturnType<typeof confirmDispatchProposal>>
        | undefined;

      if (missingJobIdSchemaResult.success) {
        const unresolvedProposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          missingJobIdSchemaResult.data,
        );
        unresolvedReviewStatus = unresolvedProposal.review?.status;
        unresolvedCandidateJobId = unresolvedProposal.review?.candidates?.jobs?.find(
          (job) => job.id === existingJob.id,
        )?.id;

        try {
          await confirmDispatchProposal(workspace.auth, conversation.id, unresolvedProposal.id);
        } catch (error) {
          unresolvedConfirmErrorCode = (error as { details?: { code?: string } }).details?.code;
        }
      }

      if (parsed.data) {
        const proposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          parsed.data,
        );
        proposalId = proposal.id;
        confirmResult = await confirmDispatchProposal(
          workspace.auth,
          conversation.id,
          proposal.id,
        );
      }

      const jobAfter = await prisma.job.findUnique({
        where: { id: existingJob.id },
      });
      const persistedProposal = proposalId
        ? await prisma.agentProposal.findUnique({ where: { id: proposalId } })
        : null;

      const assertions = [
        expectEqual("intent is SCHEDULE_JOB", intent.intent, "SCHEDULE_JOB"),
        expectEqual("customer resolver matched Archie", customerResolution.customer?.id, customer.id),
        expectEqual("job resolver matched existing job", jobResolution.job?.id, existingJob.id),
        expectEqual("staff resolver returned membershipId", staffResolution.staff?.membershipId, staff.membership.id),
        expectEqual("time resolver matched complete window", timeResolution.status, "matched"),
        expectEqual("schema accepts missing job id for review resolution", missingJobIdSchemaResult.success, true),
        expectEqual("unresolved proposal needs review", unresolvedReviewStatus, "NEEDS_RESOLUTION"),
        expectEqual("unresolved proposal includes existing job candidate", unresolvedCandidateJobId, existingJob.id),
        expectEqual("unresolved proposal cannot confirm before selection", unresolvedConfirmErrorCode, "PROPOSAL_REVIEW_REQUIRED"),
        parsed.assertion,
        expectEqual("confirmation reports existing job update", confirmResult?.updatedExistingJob, true),
        expectEqual("job count did not increase", await countJobs(workspace.tenant.id), jobCountBefore),
        expectEqual("existing job assigned to staff", jobAfter?.assignedToId, staff.user.id),
        expectEqual("existing job transitioned to scheduled", jobAfter?.status, JobStatus.SCHEDULED),
        expectEqual("proposal confirmed", persistedProposal?.status, AgentProposalStatus.CONFIRMED),
      ];

      return resultFromAssertions({
        name: "existing dishwasher job schedule uses existing job",
        prompt: "把 Archie Wright 的洗碗机漏水工单分配给 Alex Nguyen 明天 9 点",
        mode: "cheap",
        assertions,
        summary: {
          proposalId,
          existingJobId: existingJob.id,
          confirmResult,
        },
      });
    },
    runLlm: (workspace) =>
      runLlmPlannerEval(workspace, {
        name: "existing dishwasher job schedule uses existing job",
        prompt: "把 Archie Wright 的洗碗机漏水工单分配给 Alex Nguyen 明天 9 点",
        expectedProposalType: "SCHEDULE_JOB",
        mustUseExistingJob: true,
      }),
  },
  {
    name: "create job requires service address",
    prompt: "Create a new air conditioner maintenance job for Olivia Davis at 12 Jetty Road, Glenelg SA 5045",
    runCheap: async (workspace) => {
      const customer = await workspace.createCustomer({ name: "Olivia Davis" });
      const intent = classifyAgentIntent(
        "Create a new air conditioner maintenance job for Olivia Davis at 12 Jetty Road, Glenelg SA 5045",
      );
      const customerResolution = await resolveCustomerTarget(workspace.auth, {
        name: "Olivia Davis",
      });
      const jobResolution = await resolveJobTarget(workspace.auth, {
        customerId: customer.id,
        q: "air conditioner maintenance",
      });
      const missingAddress = saveTypedProposalToolInputSchema.safeParse({
        type: "CREATE_JOB",
        target: { customerId: customer.id },
        customer: {
          status: "matched",
          matchedCustomerId: customer.id,
          matches: [{ id: customer.id, name: customer.name }],
        },
        jobDraft: {
          title: "Air conditioner maintenance",
        },
        scheduleDraft: { timezone },
        warnings: [],
        confidence: 0.86,
      });
      const parsed = parsedProposalAssertion({
        type: "CREATE_JOB",
        target: { customerId: customer.id },
        customer: {
          status: "matched",
          matchedCustomerId: customer.id,
          matches: [{ id: customer.id, name: customer.name }],
        },
        jobDraft: {
          title: "Air conditioner maintenance",
          serviceAddress: "12 Jetty Road, Glenelg SA 5045",
          description: "Seasonal maintenance before summer.",
        },
        scheduleDraft: { timezone },
        warnings: [],
        confidence: 0.86,
      });
      const conversation = await createConversation(workspace.auth);
      const jobCountBefore = await countJobs(workspace.tenant.id);
      let confirmResult:
        | Awaited<ReturnType<typeof confirmDispatchProposal>>
        | undefined;

      if (parsed.data) {
        const proposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          parsed.data,
        );
        confirmResult = await confirmDispatchProposal(
          workspace.auth,
          conversation.id,
          proposal.id,
        );
      }

      const createdJob = confirmResult?.createdJobId
        ? await prisma.job.findUnique({ where: { id: confirmResult.createdJobId } })
        : null;

      return resultFromAssertions({
        name: "create job requires service address",
        prompt: "Create a new air conditioner maintenance job for Olivia Davis at 12 Jetty Road, Glenelg SA 5045",
        mode: "cheap",
        assertions: [
          expectEqual("intent is CREATE_JOB", intent.intent, "CREATE_JOB"),
          expectEqual("customer resolver matched Olivia", customerResolution.customer?.id, customer.id),
          expectEqual("job resolver says new candidate", jobResolution.status, "new_candidate"),
          expectEqual("schema rejects missing serviceAddress", missingAddress.success, false),
          parsed.assertion,
          expectEqual("job count increased by one", await countJobs(workspace.tenant.id), jobCountBefore + 1),
          expectEqual("created job serviceAddress persisted", createdJob?.serviceAddress, "12 Jetty Road, Glenelg SA 5045"),
        ],
        summary: { confirmResult },
      });
    },
  },
  {
    name: "update customer phone only changes customer profile",
    prompt: "把 Leo Martin 的电话改成 0412 999 888",
    runCheap: async (workspace) => {
      const customer = await workspace.createCustomer({
        name: "Leo Martin",
        phone: "0412 000 100",
        email: "leo@example.test",
        notes: "Prefers mornings.",
      });
      const intent = classifyAgentIntent("把 Leo Martin 的电话改成 0412 999 888");
      const customerResolution = await resolveCustomerTarget(workspace.auth, {
        name: "Leo Martin",
      });
      const parsed = parsedProposalAssertion({
        type: "UPDATE_CUSTOMER",
        target: { customerId: customer.id },
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
        ],
        warnings: [],
        confidence: 0.92,
      });
      const conversation = await createConversation(workspace.auth);
      const jobCountBefore = await countJobs(workspace.tenant.id);

      if (parsed.data) {
        const proposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          parsed.data,
        );
        await confirmDispatchProposal(workspace.auth, conversation.id, proposal.id);
      }

      const updated = await prisma.customer.findUnique({ where: { id: customer.id } });

      return resultFromAssertions({
        name: "update customer phone only changes customer profile",
        prompt: "把 Leo Martin 的电话改成 0412 999 888",
        mode: "cheap",
        assertions: [
          expectEqual("intent is UPDATE_CUSTOMER", intent.intent, "UPDATE_CUSTOMER"),
          expectEqual("customer resolver matched Leo", customerResolution.customer?.id, customer.id),
          parsed.assertion,
          expectEqual("phone updated", updated?.phone, "0412 999 888"),
          expectEqual("email unchanged", updated?.email, "leo@example.test"),
          expectEqual("job count unchanged", await countJobs(workspace.tenant.id), jobCountBefore),
        ],
      });
    },
  },
  {
    name: "ambiguous same-name customer stops before proposal",
    prompt: "把 Leo Martin 的厨房水龙头工作分配给 Harper Lee",
    runCheap: async (workspace) => {
      await workspace.createCustomer({ name: "Leo Martin", phone: "0412 001 781" });
      await workspace.createCustomer({ name: "Leo Martin", phone: "0412 004 521" });
      const conversation = await createConversation(workspace.auth);
      const customerResolution = await resolveCustomerTarget(workspace.auth, {
        name: "Leo Martin",
      });

      return resultFromAssertions({
        name: "ambiguous same-name customer stops before proposal",
        prompt: "把 Leo Martin 的厨房水龙头工作分配给 Harper Lee",
        mode: "cheap",
        assertions: [
          expectEqual("customer resolver is ambiguous", customerResolution.status, "ambiguous"),
          expectEqual("no proposal saved for ambiguous target", await countProposals(conversation.id), 0),
        ],
        summary: {
          candidateCount: customerResolution.candidates.length,
        },
      });
    },
  },
  {
    name: "missing staff cannot become matched assignee",
    prompt: "把 Archie Wright 的洗碗机工单分配给 Not A Person",
    runCheap: async (workspace) => {
      const customer = await workspace.createCustomer({ name: "Archie Wright" });
      const existingJob = await workspace.createJob({
        customerId: customer.id,
        title: "Dishwasher leak investigation - Stirling",
        serviceAddress: "8 Mount Barker Road, Stirling SA 5152",
        description: "Dishwasher leaks after long cycle.",
      });
      const staffResolution = await resolveStaffTarget(workspace.auth, {
        q: "Not A Person",
      });
      const invalidProposal = saveTypedProposalToolInputSchema.safeParse({
        type: "ASSIGN_JOB",
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
        assigneeDraft: {
          status: "matched",
          displayName: "Not A Person",
        },
        warnings: ["Requested staff member was not found."],
        confidence: 0.4,
      });

      return resultFromAssertions({
        name: "missing staff cannot become matched assignee",
        prompt: "把 Archie Wright 的洗碗机工单分配给 Not A Person",
        mode: "cheap",
        assertions: [
          expectEqual("staff resolver is missing", staffResolution.status, "missing"),
          expectEqual("schema rejects matched assignee without membershipId", invalidProposal.success, false),
        ],
      });
    },
  },
  {
    name: "schedule conflict is surfaced before saving proposal",
    prompt: "把 Noah Thompson 的吊扇安装安排给 Alex Nguyen 明天 9 点到 11 点",
    runCheap: async (workspace) => {
      const staff = await workspace.createStaff({ displayName: "Alex Nguyen" });
      const customer = await workspace.createCustomer({ name: "Noah Thompson" });
      const targetJob = await workspace.createJob({
        customerId: customer.id,
        title: "Ceiling fan installation - Henley Beach",
        serviceAddress: "20 Seaview Road, Henley Beach SA 5022",
      });
      const conflictJob = await workspace.createJob({
        customerId: customer.id,
        title: "Existing conflicting appointment",
        serviceAddress: "21 Seaview Road, Henley Beach SA 5022",
        assignedToId: staff.user.id,
        scheduledStartAt: new Date("2026-04-23T00:30:00.000Z"),
        scheduledEndAt: new Date("2026-04-23T01:30:00.000Z"),
        status: JobStatus.SCHEDULED,
      });
      const conflict = await checkScheduleConflicts(workspace.auth, {
        assigneeUserId: staff.user.id,
        scheduledStartAt: startAt,
        scheduledEndAt: endAt,
        excludeJobId: targetJob.id,
      });
      const parsed = parsedProposalAssertion({
        type: "SCHEDULE_JOB",
        target: {
          customerId: customer.id,
          jobId: targetJob.id,
        },
        customer: {
          status: "matched",
          matchedCustomerId: customer.id,
          matches: [{ id: customer.id, name: customer.name }],
        },
        jobDraft: {
          existingJobId: targetJob.id,
          title: targetJob.title,
        },
        scheduleDraft: {
          scheduledStartAt: startAt,
          scheduledEndAt: endAt,
          timezone,
        },
        assigneeDraft: {
          status: "matched",
          membershipId: staff.membership.id,
          userId: staff.user.id,
          displayName: staff.user.displayName,
        },
        warnings: ["Alex Nguyen has an overlapping scheduled job."],
        confidence: 0.74,
      });
      const conversation = await createConversation(workspace.auth);
      let savedWarnings: string[] = [];

      if (parsed.data) {
        const proposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          parsed.data,
        );
        savedWarnings = proposal.warnings;
      }

      return resultFromAssertions({
        name: "schedule conflict is surfaced before saving proposal",
        prompt: "把 Noah Thompson 的吊扇安装安排给 Alex Nguyen 明天 9 点到 11 点",
        mode: "cheap",
        assertions: [
          expectEqual("conflict check detects overlap", conflict.hasConflict, true),
          expectEqual("conflict references existing appointment", conflict.conflicts[0]?.id, conflictJob.id),
          parsed.assertion,
          expectTruthy(
            "proposal warning mentions overlap",
            savedWarnings.some((warning) => /overlap|conflict/i.test(warning)),
            { savedWarnings },
          ),
        ],
      });
    },
  },
  {
    name: "regression kitchen tap assignment does not create translated duplicate",
    prompt: "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee 明天下午2点",
    runCheap: async (workspace) => {
      const staff = await workspace.createStaff({ displayName: "Harper Lee" });
      const customer = await workspace.createCustomer({
        name: "Leo Martin",
        phone: "0412 001 781",
      });
      const existingJob = await workspace.createJob({
        customerId: customer.id,
        title: "Leaking kitchen tap - Adelaide",
        serviceAddress: "36 Greenhill Rd, Port Adelaide SA",
        description: "Kitchen tap leaking under the sink.",
      });
      const jobCountBefore = await countJobs(workspace.tenant.id);
      const intent = classifyAgentIntent(
        "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee 明天下午2点",
      );
      const customerResolution = await resolveCustomerTarget(workspace.auth, {
        name: "Leo Martin",
      });
      const jobResolution = await resolveJobTarget(workspace.auth, {
        customerId: customer.id,
        q: "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee 明天下午2点",
      });
      const staffResolution = await resolveStaffTarget(workspace.auth, {
        q: "Harper Lee",
      });
      const parsed = parsedProposalAssertion({
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
          scheduledStartAt: "2026-04-23T04:30:00.000Z",
          scheduledEndAt: "2026-04-23T06:30:00.000Z",
          timezone,
        },
        assigneeDraft: {
          status: "matched",
          membershipId: staff.membership.id,
          userId: staff.user.id,
          displayName: staff.user.displayName,
        },
        warnings: [],
        confidence: 0.9,
      });
      const conversation = await createConversation(workspace.auth);

      if (parsed.data) {
        const proposal = await storeTypedProposal(
          workspace.auth,
          conversation.id,
          parsed.data,
        );
        await confirmDispatchProposal(workspace.auth, conversation.id, proposal.id);
      }

      const duplicate = await prisma.job.findFirst({
        where: {
          tenantId: workspace.tenant.id,
          title: "厨房水龙头漏水维修",
        },
      });
      const existingAfter = await prisma.job.findUnique({
        where: { id: existingJob.id },
      });

      return resultFromAssertions({
        name: "regression kitchen tap assignment does not create translated duplicate",
        prompt: "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee 明天下午2点",
        mode: "cheap",
        assertions: [
          expectEqual("intent is SCHEDULE_JOB", intent.intent, "SCHEDULE_JOB"),
          expectEqual("customer resolver matched Leo", customerResolution.customer?.id, customer.id),
          expectEqual("job resolver matched existing job", jobResolution.job?.id, existingJob.id),
          expectEqual("staff resolver matched Harper", staffResolution.staff?.membershipId, staff.membership.id),
          parsed.assertion,
          expectEqual("job count did not increase", await countJobs(workspace.tenant.id), jobCountBefore),
          expectEqual("translated duplicate was not created", duplicate, null),
          expectEqual("existing title preserved", existingAfter?.title, existingJob.title),
          expectEqual("existing job assigned", existingAfter?.assignedToId, staff.user.id),
        ],
      });
    },
    runLlm: (workspace) =>
      runLlmPlannerEval(workspace, {
        name: "regression kitchen tap assignment does not create translated duplicate",
        prompt: "Leaking kitchen tap - Adelaide, Leo Martin 这份工作分配给 Harper Lee 明天下午2点",
        expectedProposalType: "SCHEDULE_JOB",
        mustUseExistingJob: true,
      }),
  },
];
