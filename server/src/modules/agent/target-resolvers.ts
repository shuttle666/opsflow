import {
  JobStatus,
  MembershipRole,
  MembershipStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { normalizeScheduleDraftTimezone } from "./agent-time";

type ResolverStatus = "matched" | "ambiguous" | "missing" | "new_candidate";

type CustomerCandidate = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type JobCandidate = {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  customer: {
    id: string;
    name: string;
  };
  assignedToName: string | null;
  score: number;
};

type StaffCandidate = {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
};

const openJobStatuses = [
  JobStatus.NEW,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
  JobStatus.PENDING_REVIEW,
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "job",
  "work",
  "repair",
  "service",
  "services",
]);

const jobConceptPatterns = [
  ["leak", /leak|漏水|渗漏|漏/iu],
  ["tap", /\btaps?\b|\bfaucets?\b|水龙头|龙头/iu],
  ["kitchen", /\bkitchen\b|厨房/iu],
  ["dishwasher", /\bdish\s*washer\b|\bdishwasher\b|洗碗机/iu],
  ["investigation", /investigat|inspect|diagnos|调查|检查/iu],
  ["installation", /install|安装/iu],
  ["ceiling", /\bceiling\b|天花板|吊顶/iu],
  ["fan", /\bfans?\b|风扇|吊扇/iu],
  ["aircon", /\bair\s*con\b|\bac\b|\bair\s*condition|空调/iu],
  ["maintenance", /mainten|service|维护|保养/iu],
] satisfies Array<[string, RegExp]>;

function normalize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(value?: string | null) {
  return new Set(
    (normalize(value).match(/[a-z0-9\u4e00-\u9fff]+/gu) ?? []).filter(
      (token) => token.length >= 2 && !stopWords.has(token),
    ),
  );
}

function sharedTokenScore(query: string, candidate: string) {
  const queryTokens = tokens(query);
  const candidateTokens = tokens(candidate);

  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(queryTokens.size, 1);
}

function extractJobConcepts(value: string) {
  const concepts = new Set<string>();

  for (const [concept, pattern] of jobConceptPatterns) {
    if (pattern.test(value)) {
      concepts.add(concept);
    }
  }

  return concepts;
}

function sharedConceptScore(query: string, candidate: string) {
  const queryConcepts = extractJobConcepts(query);
  const candidateConcepts = extractJobConcepts(candidate);

  if (queryConcepts.size === 0 || candidateConcepts.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const concept of queryConcepts) {
    if (candidateConcepts.has(concept)) {
      shared += 1;
    }
  }

  return shared / Math.max(queryConcepts.size, 1);
}

function scoreJob(input: ResolveJobTargetInput, job: {
  title: string;
  description: string | null;
  serviceAddress: string;
  customerName?: string;
}) {
  const queryText = [input.q, input.title, input.description].filter(Boolean).join(" ");
  const jobText = [job.title, job.description, job.customerName].filter(Boolean).join(" ");
  let score = 0;
  const normalizedJobText = normalize(jobText);
  const normalizedQueryText = normalize(queryText);
  const normalizedTitle = normalize(job.title);

  if (
    queryText &&
    (normalizedJobText.includes(normalizedQueryText) ||
      (normalizedTitle.length >= 6 && normalizedQueryText.includes(normalizedTitle)))
  ) {
    score += 0.45;
  }

  score += sharedTokenScore(queryText, jobText) * 0.35;
  score += sharedConceptScore(queryText, jobText) * 0.4;

  if (input.serviceAddress) {
    const addressScore = sharedTokenScore(input.serviceAddress, job.serviceAddress);
    score += addressScore * 0.25;
    if (normalize(job.serviceAddress).includes(normalize(input.serviceAddress))) {
      score += 0.2;
    }
  }

  return Math.min(1, score);
}

export type ResolveCustomerTargetInput = {
  q?: string;
  name?: string;
  phone?: string;
  email?: string;
};

export type ResolveCustomerTargetResult = {
  status: ResolverStatus;
  confidence: number;
  reason: string;
  customer?: CustomerCandidate;
  candidates: CustomerCandidate[];
};

export async function resolveCustomerTarget(
  auth: AuthContext,
  input: ResolveCustomerTargetInput,
): Promise<ResolveCustomerTargetResult> {
  const q = input.q?.trim() || input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();

  if (!q && !email && !phone) {
    return {
      status: "missing",
      confidence: 0,
      reason: "No customer query was provided.",
      candidates: [],
    };
  }

  const customers = await prisma.customer.findMany({
    where: {
      tenantId: auth.tenantId,
      archivedAt: null,
      OR: [
        ...(q
          ? [
              {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  });

  if (customers.length === 0) {
    return {
      status: "new_candidate",
      confidence: 0.7,
      reason: "No active customer matched the query.",
      candidates: [],
    };
  }

  const exactMatches = customers.filter((customer) => {
    return (
      (email && customer.email?.toLowerCase() === email) ||
      (phone && customer.phone === phone) ||
      (q && normalize(customer.name) === normalize(q))
    );
  });
  const candidates = exactMatches.length > 0 ? exactMatches : customers;

  if (candidates.length === 1) {
    return {
      status: "matched",
      confidence: exactMatches.length > 0 ? 0.96 : 0.78,
      reason: "Exactly one active customer matched the query.",
      customer: candidates[0],
      candidates,
    };
  }

  return {
    status: "ambiguous",
    confidence: 0.55,
    reason: "Multiple active customers matched the query.",
    candidates,
  };
}

export type ResolveJobTargetInput = {
  q?: string;
  title?: string;
  description?: string;
  serviceAddress?: string;
  customerId?: string;
  includeClosed?: boolean;
};

export type ResolveJobTargetResult = {
  status: ResolverStatus;
  confidence: number;
  reason: string;
  job?: JobCandidate;
  candidates: JobCandidate[];
};

export async function resolveJobTarget(
  auth: AuthContext,
  input: ResolveJobTargetInput,
): Promise<ResolveJobTargetResult> {
  const query = input.q?.trim() || input.title?.trim() || input.serviceAddress?.trim();

  if (!query && !input.customerId) {
    return {
      status: "missing",
      confidence: 0,
      reason: "No job query or customer target was provided.",
      candidates: [],
    };
  }

  const jobs = await prisma.job.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.includeClosed
        ? {}
        : {
            status: {
              in: openJobStatuses,
            },
          }),
      ...(query && !input.customerId
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
              { serviceAddress: { contains: query, mode: "insensitive" as const } },
              {
                customer: {
                  name: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          displayName: true,
        },
      },
    },
  });

  if (jobs.length === 0) {
    return {
      status: "new_candidate",
      confidence: 0.7,
      reason: "No existing job matched the query.",
      candidates: [],
    };
  }

  const candidates = jobs
    .map((job) => ({
      id: job.id,
      title: job.title,
      serviceAddress: job.serviceAddress,
      status: job.status,
      scheduledStartAt: job.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: job.scheduledEndAt?.toISOString() ?? null,
      customer: job.customer,
      assignedToName: job.assignedTo?.displayName ?? null,
      score: scoreJob(input, {
        title: job.title,
        description: job.description,
        serviceAddress: job.serviceAddress,
        customerName: job.customer.name,
      }),
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const second = candidates[1];

  if (best && (best.score >= 0.72 || (candidates.length === 1 && best.score >= 0.35))) {
    if (second && best.score - second.score < 0.15) {
      return {
        status: "ambiguous",
        confidence: best.score,
        reason: "Multiple jobs are close matches.",
        candidates: candidates.slice(0, 5),
      };
    }

    return {
      status: "matched",
      confidence: Math.max(best.score, 0.74),
      reason: "One existing job strongly matched the query.",
      job: best,
      candidates: candidates.slice(0, 5),
    };
  }

  return {
    status: candidates.length === 1 ? "new_candidate" : "ambiguous",
    confidence: best?.score ?? 0,
    reason:
      candidates.length === 1
        ? "The only candidate was not similar enough to update automatically."
        : "No single job matched strongly enough.",
    candidates: candidates.slice(0, 5),
  };
}

export type ResolveStaffTargetInput = {
  q?: string;
};

export type ResolveStaffTargetResult = {
  status: Exclude<ResolverStatus, "new_candidate">;
  confidence: number;
  reason: string;
  staff?: StaffCandidate;
  candidates: StaffCandidate[];
};

export async function resolveStaffTarget(
  auth: AuthContext,
  input: ResolveStaffTargetInput,
): Promise<ResolveStaffTargetResult> {
  const q = input.q?.trim();

  if (!q) {
    return {
      status: "missing",
      confidence: 0,
      reason: "No staff query was provided.",
      candidates: [],
    };
  }

  const memberships = await prisma.membership.findMany({
    where: {
      tenantId: auth.tenantId,
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
      OR: [
        {
          user: {
            displayName: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
        },
        {
          user: {
            email: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
        },
      ],
    },
    orderBy: {
      user: {
        displayName: "asc",
      },
    },
    take: 10,
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  const candidates = memberships.map((membership) => ({
    membershipId: membership.id,
    userId: membership.userId,
    displayName: membership.user.displayName,
    email: membership.user.email,
  }));
  const exactMatches = candidates.filter(
    (candidate) =>
      normalize(candidate.displayName) === normalize(q) ||
      normalize(candidate.email) === normalize(q),
  );
  const effectiveCandidates = exactMatches.length > 0 ? exactMatches : candidates;

  if (effectiveCandidates.length === 0) {
    return {
      status: "missing",
      confidence: 0.7,
      reason: "No active staff member matched the query.",
      candidates: [],
    };
  }

  if (effectiveCandidates.length === 1) {
    return {
      status: "matched",
      confidence: exactMatches.length > 0 ? 0.96 : 0.78,
      reason: "Exactly one active staff member matched the query.",
      staff: effectiveCandidates[0],
      candidates: effectiveCandidates,
    };
  }

  return {
    status: "ambiguous",
    confidence: 0.55,
    reason: "Multiple active staff members matched the query.",
    candidates: effectiveCandidates,
  };
}

export type ResolveTimeWindowInput = {
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  localDate?: string | null;
  localEndDate?: string | null;
  localStartTime?: string | null;
  localEndTime?: string | null;
  timezone: string;
};

export function resolveTimeWindow(input: ResolveTimeWindowInput) {
  const normalized = normalizeScheduleDraftTimezone(input);
  const start = normalized.scheduledStartAt?.trim();
  const end = normalized.scheduledEndAt?.trim();

  if (!start && !end) {
    return {
      status: "missing" as const,
      confidence: 0,
      reason: "No time window was provided.",
      timezone: normalized.timezone,
      scheduledStartAt: null,
      scheduledEndAt: null,
    };
  }

  if (!start || !end) {
    return {
      status: "ambiguous" as const,
      confidence: 0.4,
      reason: "A complete start and end time are required.",
      timezone: normalized.timezone,
      scheduledStartAt: start ?? null,
      scheduledEndAt: end ?? null,
    };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return {
      status: "ambiguous" as const,
      confidence: 0.35,
      reason: "The supplied time window is invalid.",
      timezone: normalized.timezone,
      scheduledStartAt: start,
      scheduledEndAt: end,
    };
  }

  return {
    status: "matched" as const,
    confidence: 0.9,
    reason: "A valid time window was supplied.",
    timezone: normalized.timezone,
    localDate: normalized.localDate ?? null,
    localEndDate: normalized.localEndDate ?? null,
    localStartTime: normalized.localStartTime ?? null,
    localEndTime: normalized.localEndTime ?? null,
    scheduledStartAt: startDate.toISOString(),
    scheduledEndAt: endDate.toISOString(),
  };
}
