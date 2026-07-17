# Roadmap

This roadmap is aligned with the current codebase. Phase names describe the product capability that exists now, not just the original plan.

## Phase 1
- Status: Completed
- Project initialization
- Docker development environment
- Base client/server structure
- Base Prisma setup

## Phase 2
- Status: Completed
- Core multi-tenant data model
- Users, tenants, memberships, customers, jobs, and job status history
- Seed data and database reset flow
- Job status transition domain layer

## Phase 3
- Status: Completed
- Authentication and refresh sessions
- Tenant context and tenant switching
- RBAC middleware
- Tenant invitations and invitation inbox UX

## Phase 4
- Status: Completed
- Customer feature end-to-end
- Customer list, create, detail, edit, search, pagination, and notes
- Tenant-scoped customer API tests

## Phase 5
- Status: Completed
- Job feature end-to-end
- Job list, create, detail, edit, filtering, pagination, and staff workspace
- Tenant-safe customer/job relation

## Phase 6
- Status: Completed
- Team management
- Membership list and owner-only membership updates
- Job assignment and unassignment
- Staff-only assigned-job visibility through `/jobs/my`

## Phase 7
- Status: Completed
- Workflow API: `/jobs/:id/history` and `/jobs/:id/status-transitions`
- Live job timeline UI
- Tenant activity feed backed by audit logs

## Phase 8
- Status: Completed
- Job evidence and documents
- Upload, list, download, and delete flows
- Local storage abstraction for evidence files

## Phase 9
- Status: Completed
- Schedule calendar
- `scheduledStartAt` / `scheduledEndAt` job windows
- Schedule day/range APIs
- Schedule conflict checks
- Day/week/month schedule UI

## Phase 10
- Status: Completed
- Completion review workflow
- `PENDING_REVIEW` job status
- Staff completion submission
- Owner/manager approve or return for rework
- Completion review audit and notification events

## Phase 11
- Status: Completed
- In-app notification persistence
- Unread notification APIs
- Authenticated SSE notification stream
- Workspace bell notification UI

## Phase 12
- Status: Completed
- AI dispatch planner
- Conversation API and SSE assistant responses
- Tool-assisted customer, job, staff, activity, and schedule lookup
- Dispatch proposal confirmation that creates customers/jobs and can assign/schedule work

## Phase 13
- Status: Completed
- Dashboard hardening
- `GET /api/dashboard/summary`
- Backend-backed dashboard metrics for the current daily dispatch surface
- Role-aware staff dashboard scoping
- Schedule preview, attention items, and conflict-aware daily stats

## Phase 14
- Status: Completed
- Provider-neutral Tool Registry shared by the Web Agent and protocol adapters
- Task-oriented read/proposal tools with role and audience exposure rules
- Local stdio MCP server with access-session validation and contract tests
- Separate proposal and execution tools for eligible `CREATE_JOB`, `ASSIGN_JOB`, and `SCHEDULE_JOB` flows, with execution allowed only after a later confirmation turn
- Authenticated Web-button approval as the strongest path, plus approval-URL fallback and Web-only proposal handling
- Documented external-host trust boundary and destructive MCP tool hint
- PII-minimized Web/MCP tool invocation audit records

## Phase 15
- Status: Completed
- TanStack Query ownership for migrated operational REST server state
- Tenant, user, and role-scoped query keys with previous-scope eviction and mutation-cache clearing across authorization boundaries
- Refresh-aware authenticated queries and mutation-driven cache reconciliation
- Notification SSE events synchronized into the notification query cache
- Agent conversation REST state and completed stream results reconciled into scoped caches while token streaming remains imperative
- Zustand narrowed to auth/session, active-tenant, theme, and local preference state

## Later Candidates
- Expanded production observability: broader application logs, rate limiting, error taxonomy, and external error monitoring
- Expanded dashboard analytics: customer count, job status breakdowns, pending invitations, recent activity, and broader upcoming schedule summaries
- S3-compatible evidence storage
- Customer portal
- Payments and billing
- Route optimization and third-party integrations
- Remote MCP transport, OAuth/client registration, and public MCP operations
