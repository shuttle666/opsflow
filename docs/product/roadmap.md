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
- Status: Planned next
- Dashboard hardening
- Replace client-derived dashboard stats with real backend tenant metrics
- Add a dashboard summary API
- Add role-specific dashboard views

## Later Candidates
- Production observability: request IDs, structured logs, rate limiting, and error monitoring
- S3-compatible evidence storage
- Customer portal
- Payments and billing
- Route optimization and third-party integrations
