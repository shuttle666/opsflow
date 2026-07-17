type QueryScope = {
  tenantId?: string | null;
  userId?: string | null;
  role?: string | null;
};

function scopeKey(scope: QueryScope) {
  return [
    "opsflow",
    "scope",
    {
      tenantId: scope.tenantId ?? null,
      userId: scope.userId ?? null,
      role: scope.role ?? null,
    },
  ] as const;
}

export const queryKeys = {
  all: ["opsflow"] as const,
  scope: scopeKey,
  dashboard: {
    all: (scope: QueryScope) => [...scopeKey(scope), "dashboard"] as const,
    summary: (scope: QueryScope, query: object) =>
      [...queryKeys.dashboard.all(scope), "summary", query] as const,
  },
  customers: {
    all: (scope: QueryScope) => [...scopeKey(scope), "customers"] as const,
    lists: (scope: QueryScope) => [...queryKeys.customers.all(scope), "list"] as const,
    list: (scope: QueryScope, query: object) =>
      [...queryKeys.customers.lists(scope), query] as const,
    details: (scope: QueryScope) =>
      [...queryKeys.customers.all(scope), "detail"] as const,
    detail: (scope: QueryScope, customerId: string) =>
      [...queryKeys.customers.details(scope), customerId] as const,
  },
  jobs: {
    all: (scope: QueryScope) => [...scopeKey(scope), "jobs"] as const,
    lists: (scope: QueryScope) => [...queryKeys.jobs.all(scope), "list"] as const,
    list: (scope: QueryScope, query: object) =>
      [...queryKeys.jobs.lists(scope), query] as const,
    myLists: (scope: QueryScope) => [...queryKeys.jobs.all(scope), "my-list"] as const,
    myList: (scope: QueryScope, query: object) =>
      [...queryKeys.jobs.myLists(scope), query] as const,
    details: (scope: QueryScope) => [...queryKeys.jobs.all(scope), "detail"] as const,
    detail: (scope: QueryScope, jobId: string) =>
      [...queryKeys.jobs.details(scope), jobId] as const,
    history: (scope: QueryScope, jobId: string) =>
      [...queryKeys.jobs.detail(scope, jobId), "history"] as const,
    evidence: (scope: QueryScope, jobId: string) =>
      [...queryKeys.jobs.detail(scope, jobId), "evidence"] as const,
    completionReview: (scope: QueryScope, jobId: string) =>
      [...queryKeys.jobs.detail(scope, jobId), "completion-review"] as const,
    schedules: (scope: QueryScope) =>
      [...queryKeys.jobs.all(scope), "schedule"] as const,
    schedule: (scope: QueryScope, query: object) =>
      [...queryKeys.jobs.schedules(scope), query] as const,
  },
  memberships: {
    all: (scope: QueryScope) => [...scopeKey(scope), "memberships"] as const,
    lists: (scope: QueryScope) =>
      [...queryKeys.memberships.all(scope), "list"] as const,
    list: (scope: QueryScope, query: object) =>
      [...queryKeys.memberships.lists(scope), query] as const,
  },
  activity: {
    all: (scope: QueryScope) => [...scopeKey(scope), "activity"] as const,
    list: (scope: QueryScope, query: object) =>
      [...queryKeys.activity.all(scope), "list", query] as const,
  },
  invitations: {
    all: (scope: QueryScope) => [...scopeKey(scope), "invitations"] as const,
    mine: (scope: QueryScope) =>
      [...queryKeys.invitations.all(scope), "mine"] as const,
    tenantLists: (scope: QueryScope) =>
      [...queryKeys.invitations.all(scope), "tenant-list"] as const,
    tenantList: (scope: QueryScope, status?: string) =>
      [...queryKeys.invitations.tenantLists(scope), status ?? "all"] as const,
  },
  notifications: {
    all: (scope: QueryScope) => [...scopeKey(scope), "notifications"] as const,
    lists: (scope: QueryScope) =>
      [...queryKeys.notifications.all(scope), "list"] as const,
    list: (scope: QueryScope, query: object) =>
      [...queryKeys.notifications.lists(scope), query] as const,
    unreadCount: (scope: QueryScope) =>
      [...queryKeys.notifications.all(scope), "unread-count"] as const,
  },
  agent: {
    all: (scope: QueryScope) => [...scopeKey(scope), "agent"] as const,
    conversations: (scope: QueryScope) =>
      [...queryKeys.agent.all(scope), "conversations"] as const,
    conversation: (scope: QueryScope, conversationId: string) =>
      [...queryKeys.agent.conversations(scope), conversationId] as const,
  },
};

export type { QueryScope };
