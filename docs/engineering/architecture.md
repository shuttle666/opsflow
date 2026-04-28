# Architecture

## Overview
OpsFlow is a modular monolith with a Next.js frontend, an Express API, Prisma, PostgreSQL, and Docker-based local/production infrastructure.

## Repository Layout
- `client` - Next.js App Router application
- `server` - Express API, Prisma schema, migrations, tests, and seed/dev scripts
- `docs` - product, engineering, and design documentation
- `infra` - deployment scripts and nginx production assets

## Frontend
- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Zustand for auth/session state
- TanStack Query-style server state patterns through feature API modules
- React Hook Form and Zod for form handling and validation
- Vitest and Testing Library for UI tests

Current app surfaces:
- Login, register, and invitation acceptance
- Dashboard with live today's schedule and schedule-derived stats
- Customers
- Jobs and staff workspace
- Team management
- Activity feed
- Schedule calendar
- AI dispatch planner
- Notification bell and SSE updates

## Backend
- Express 5
- TypeScript
- Prisma ORM with PostgreSQL
- Zod request validation
- JWT access tokens with persisted refresh sessions
- Tenant-aware middleware and role checks
- Supertest/Vitest integration tests

Current modules:
- `auth` - registration, login, refresh, logout, tenant switching, invitations, RBAC helpers
- `customer` - tenant-scoped customer CRUD and notes
- `job` - job CRUD, schedule windows, assignment, workflow, schedule APIs, completion review
- `evidence` - job evidence upload/list/download/delete
- `membership` - team membership listing and owner-only role/status updates
- `audit` - tenant activity feed from audit logs
- `notification` - persisted notifications, unread counts, and SSE streaming
- `agent` - persisted AI dispatch planner conversations, tool traces, proposals, and proposal confirmation

## Database
PostgreSQL is the system of record. Tenant isolation is enforced through `tenantId` on business entities and tenant-aware query filters.

Core persisted models:
- `User`
- `Tenant`
- `Membership`
- `Customer`
- `Job`
- `JobStatusHistory`
- `JobCompletionReview`
- `JobEvidence`
- `AuthSession`
- `TenantInvitation`
- `AuditLog`
- `Notification`
- `AgentConversation`
- `AgentMessage`
- `AgentToolCall`
- `AgentProposal`

## Key Flows

### Authentication And Tenant Context
Users authenticate with email/password. Successful login issues an access token and refresh token tied to an `AuthSession`. Tenant context is included in the authenticated request context and can be switched through `/api/auth/switch-tenant`.

### Job Lifecycle
Owners/managers create jobs for tenant customers. Jobs can be assigned to active staff, scheduled with start/end windows, moved through the workflow, and surfaced in staff-specific views.

### Completion Review
Staff submit completion notes from `IN_PROGRESS`. The job moves to `PENDING_REVIEW`. Owners/managers approve the review to complete the job or return it to `IN_PROGRESS` with a note.

### Evidence
Evidence files are uploaded through job-scoped endpoints and stored through a storage abstraction. The current default uses local disk storage.

### Notifications And Activity
Activity is tenant-wide audit history for owners/managers. Notifications are user-specific unread reminders and can stream to the UI over SSE.

### AI Dispatch Planner
The agent uses Anthropic, repository-local tools, and explicit confirmation. It can search customers, jobs, staff, activity, and schedule conflicts, then save a proposal. Confirmation can create customers/jobs, assign work, and move scheduled jobs to `SCHEDULED`.

Agent conversations, messages, tool calls, and proposals are persisted in PostgreSQL. Confirmed proposals are retained with confirmation metadata for audit.

## Infrastructure
- Local development uses `docker-compose.dev.yml`.
- Production uses `docker-compose.prod.yml`.
- Nginx and production deploy scripts live under `infra`.
- GitHub Actions runs CI and deploys successful `main` builds to EC2.
- HTTPS is served through Nginx and Certbot.

## Current Limitations
- Dashboard business metrics are not fully backed by a dedicated summary API yet.
- Request IDs, structured logs, rate limiting, and external error monitoring are planned but not fully implemented.
- Evidence storage is local-first; S3-compatible storage is a future upgrade.
- There is no customer-facing portal yet.
