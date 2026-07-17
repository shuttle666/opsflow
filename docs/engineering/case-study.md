# OpsFlow Engineering Case Study

## Snapshot

| | |
| --- | --- |
| Project | Portfolio product demonstrating production-style SaaS engineering |
| Author | Wenduo Wang |
| Role | Product owner and full-stack engineer |
| Team model | Independently owned portfolio project with AI-assisted delivery disclosed below |
| Scope | Product definition, system design, frontend, backend, data model, AI safety boundary, testing, deployment, and documentation |
| Architecture | Next.js client, Express modular monolith, Prisma/PostgreSQL, Docker, and a shared AI/MCP Tool Registry |

OpsFlow models the internal workflow of a field-service business: customers become scheduled jobs, jobs are assigned to staff, field evidence is reviewed, and operational changes remain visible through history, notifications, and audit records.

The project is intentionally broader than a UI demonstration. Its main engineering question is: how can a multi-tenant operations product add useful AI actions without allowing an unapproved model-originated change to business data?

## My Role And Ownership

I own the product and engineering direction of this portfolio project. My responsibilities include:

- defining the product scope and deciding which workflows belong in the demonstrable release;
- designing the tenant, membership, RBAC, job lifecycle, evidence, notification, and audit boundaries;
- choosing the modular-monolith architecture and the separation between domain services, protocol adapters, and infrastructure;
- defining the proposal-first safety boundary for AI-initiated writes;
- reviewing implementation changes for tenant isolation, authorization, failure behavior, and maintainability;
- defining acceptance criteria, running automated validation, and deciding when work is ready to ship;
- maintaining the deployment path and keeping product and engineering documentation aligned with the code.

AI tools assisted the workflow, as described below, but product decisions, architecture choices, security boundaries, code review, verification, and final acceptance remained my responsibility.

## Delivered Scope

The current case-study boundary includes:

- persisted authentication sessions, tenant switching, invitations, and `OWNER`/`MANAGER`/`STAFF` authorization;
- tenant-scoped customer, job, assignment, schedule, evidence, review, activity, and notification workflows;
- role-aware dashboards and staff workspaces;
- authorization-scoped TanStack Query caches for migrated REST and Agent conversation state, with mutation-driven cache reconciliation;
- request IDs, stable API error codes, structured request/error logging, and user-visible support correlation;
- persisted AI conversations, tool calls, and proposals;
- a provider-neutral Tool Registry shared by the Web Agent and local MCP adapter;
- separate approval/confirmation checkpoints and confirmation-time validation for AI-proposed business changes;
- client and server tests, CI validation, Docker environments, and an EC2/Nginx deployment path.

Payments, a customer portal, route optimization, remote MCP transport, object storage, and a full production observability platform are deliberately outside the current boundary. See the [PRD](../product/prd.md) and [roadmap](../product/roadmap.md) for the maintained scope.

## Architecture Decisions And Trade-offs

### Modular Monolith Before Microservices

The API is divided into domain modules, but it ships as one service. This keeps transactions, local development, tests, and deployment understandable for the current product size. The trade-off is that modules scale and deploy together; service extraction would only be justified by measured ownership or scaling pressure.

### Explicit Application-layer Tenant Isolation

Business records carry `tenantId`, and authenticated services apply tenant-aware filters and role checks. This works naturally with Prisma and keeps access decisions visible in application code. It also means every new query must preserve the invariant, so tenant-boundary integration tests and code review are part of the safety model. PostgreSQL row-level security is a possible future defense-in-depth layer, not a claimed current control.

### Separate Server State From Client State

TanStack Query now owns migrated REST-backed dashboard, customer, job, schedule, membership, activity, invitation, notification, and Agent conversation data. Cache keys include the tenant, user, and role; query functions reuse the auth store's refresh-aware token path; successful mutations update known cache entries or invalidate affected domain keys. A scope change evicts the previous authorization scope and clears mutation results and payloads without racing the new scope's active queries. Zustand remains focused on auth/session, active-tenant, theme, and local preference state.

This removes duplicated loading/error/refetch state and makes cross-page updates explicit. The trade-off is designing invalidation as part of every mutation instead of relying on a full reload. Notification SSE still owns its connection lifecycle and writes incoming events into the Query cache. AI token streaming and cancellation also remain imperative, then reconcile completed messages/proposals into Agent caches and invalidate operational domains after an executed proposal. File downloads and ephemeral UI state remain imperative by design.

### Proposal-first AI Writes

The Web Agent can read through approved tools, but an AI-initiated operational change is stored as a pending proposal rather than applied immediately. Execution is a separate step restricted to an authorized owner or manager. The authenticated Web button provides an approval path that does not depend on LLM interpretation. Eligible `CREATE_JOB`, `ASSIGN_JOB`, and `SCHEDULE_JOB` proposals can also use a separate destructive execution tool only after a later confirmation turn; the original business request cannot count as confirmation. Other proposal types are Web-only.

Every path rechecks proposal ownership, review state, current tenant-scoped targets, and domain rules before the transactional change. The Proposal ID is also the idempotency boundary, so an already confirmed proposal returns its stored receipt rather than repeating writes.

This adds proposal state, approval UI, stale-data handling, and a documented trust boundary. The Web Agent can prove that a matching user message was persisted after proposal creation; an external MCP server cannot independently prove that its host presented the proposal faithfully or that supplied confirmation text came from a human. Capable hosts should therefore show native approval for the destructive tool, while the authenticated Web button remains the strongest approval evidence. The shared registry, confirmation sources, and limitations are described in [Local MCP Integration](mcp.md).

### One Tool Contract For Web And MCP

The Web Agent and local MCP server adapt the same canonical Tool Registry instead of maintaining separate business implementations. Each entry owns its Zod schemas, audience and role policy, behavior annotations, and execution handler.

This reduces schema and authorization drift. The cost is adapter work at each protocol boundary and the need to keep result contracts provider-neutral. MCP is intentionally local stdio today; remote transport would require a separate OAuth/client-registration threat model.

### Local-first Evidence Storage Behind An Abstraction

Evidence storage uses the local filesystem in the current deployment, behind a storage interface. That made the upload and review workflow deliverable without introducing cloud-storage configuration into the first release. It is not horizontally portable, so an S3-compatible implementation and lifecycle cleanup are explicit follow-up work.

## Evidence In The Repository

| Engineering claim | Inspectable evidence |
| --- | --- |
| Tenant-aware architecture and domain boundaries | [Architecture](architecture.md), [Prisma schema](../../server/prisma/schema.prisma), and [server tests](../../server/tests) |
| Scoped client server-state ownership | [Query keys](../../client/src/lib/query-keys.ts), [authenticated query hooks](../../client/src/hooks/use-authenticated-query.ts), [customer cache reconciliation](../../client/src/features/customer/customer-queries.ts), and [Agent cache/stream boundary](../../client/src/features/agent/agent-queries.ts) |
| Stable API errors and request correlation | [API Design](api-design.md), [request context](../../server/src/middleware/request-context.ts), and [request logger](../../server/src/middleware/request-logger.ts) |
| Shared Web/MCP business tools | [Tool Registry](../../server/src/modules/operations-tools/tool-registry.ts) and [MCP contract tests](../../server/tests/mcp-server.contract.test.ts) |
| Proposal-first AI changes | [Proposal tool definitions](../../server/src/modules/operations-tools/definitions/proposal-tools.ts), [proposal tool tests](../../server/tests/proposal-tools.unit.test.ts), and [persistence integration tests](../../server/tests/agent-persistence.integration.test.ts) |
| PII-minimized cross-adapter invocation audit | [Invocation audit adapter](../../server/src/modules/operations-tools/tool-invocation-audit.ts) |
| Automated delivery checks | [CI workflow](../../.github/workflows/ci.yml) and client/server package scripts |

These are engineering signals, not claims of customer adoption or production scale. The portfolio evidence is the explicit boundary design, code, tests, and deployment automation.

## AI-assisted Workflow

AI was used as an engineering accelerator, not as an unreviewed source of truth:

1. Early visual directions were explored with Pencil and Claude Design. Their exported artifacts remain under `docs/design` as provenance and reference material; they are not the production Next.js implementation.
2. Coding assistants helped explore alternatives, scaffold and refactor implementation work, propose tests, and cross-check documentation against the repository.
3. I selected the product and architecture direction, constrained each task, reviewed the resulting diffs, and rejected or revised claims that the implementation did not support.
4. I validated changes through linting, type checks, automated tests, builds, focused code inspection, and end-to-end workflow checks appropriate to the change.

This workflow demonstrates an additional skill relevant to modern engineering: using AI tools quickly while preserving human accountability for security, correctness, and release decisions.

## Retrospective

### What Worked Well

- Building the real customer-to-completion workflow before adding AI gave the tools stable domain services to call.
- Persisting proposals and requiring a separate confirmation checkpoint made the AI boundary understandable in both code and UI.
- Moving Web and MCP operations behind one registry reduced duplicated policy and made protocol expansion easier to reason about.
- Integration and contract tests made tenant boundaries, role behavior, and API contracts inspectable rather than implicit.

### What I Would Do Earlier

- Introduce a consistent server-state query layer before page-level data fetching spread across the client.
- Design public demo isolation as per-visitor leased workspaces instead of relying on a shared account and scheduled resets.
- Separate database cleanup from durable-file lifecycle cleanup from the first evidence-storage iteration.
- Define AI usage budgets and production telemetry alongside the first externally accessible AI endpoint.

### Next Engineering Priorities

1. Isolate public demo visitors with bounded workspace leases, complete agent-data resets, and durable evidence cleanup.
2. Add lease-level and global AI budgets with persistent usage accounting.
3. Replace local evidence storage with an S3-compatible implementation.
4. Expand request-level logs into centralized monitoring, metrics, tracing, and external error reporting when deployment needs justify it.
