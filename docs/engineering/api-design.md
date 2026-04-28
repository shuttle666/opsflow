# API Design

This document is aligned with the Express routers under `server/src/routes` and `server/src/modules`.

## Current Status
- Base API path: `/api`
- Authentication uses short-lived JWT access tokens plus persisted refresh sessions. Refresh tokens are delivered in an HttpOnly `opsflow_refresh` cookie.
- Tenant scope is resolved from the authenticated session; business requests do not accept `tenantId` in the body.
- Authorization uses `OWNER`, `MANAGER`, and `STAFF` roles.
- List endpoints return `{ success, message, data, meta.pagination }`.
- Job scheduling now uses `scheduledStartAt` and `scheduledEndAt`. Older `scheduledAt` references are legacy.

## Health
- `GET /health`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/switch-tenant`

## Tenant Invitations
- `POST /tenants/:tenantId/invitations` - owner/manager
- `GET /tenants/:tenantId/invitations` - owner/manager
- `POST /tenants/:tenantId/invitations/:invitationId/resend` - owner/manager
- `POST /tenants/:tenantId/invitations/:invitationId/cancel` - owner/manager
- `GET /invitations/mine`
- `POST /invitations/:invitationId/accept`
- `POST /invitations/accept`

## Customers
- `GET /customers`
- `POST /customers` - owner/manager
- `GET /customers/:customerId`
- `PATCH /customers/:customerId` - owner/manager
- `DELETE /customers/:customerId` - owner/manager, archives customer
- `POST /customers/:customerId/restore` - owner/manager

Customer fields include `name`, `phone`, `email`, `notes`, and `archivedAt`. Service locations are stored on jobs as `serviceAddress`, not on customer profiles.
Customer list accepts `status=active|archived|all` and defaults to `active`.

## Jobs
- `GET /jobs` - owner/manager
- `POST /jobs` - owner/manager
- `GET /jobs/my`
- `GET /jobs/:jobId`
- `PATCH /jobs/:jobId` - owner/manager

Job create/update input includes:
- `customerId`
- `title`
- `serviceAddress`
- `description`
- `scheduledStartAt`
- `scheduledEndAt`

Job list filters include:
- `q`
- `status`
- `customerId`
- `scheduledFrom`
- `scheduledTo`
- `page`
- `pageSize`
- `sort`

Supported job statuses:
- `NEW`
- `SCHEDULED`
- `IN_PROGRESS`
- `PENDING_REVIEW`
- `COMPLETED`
- `CANCELLED`

## Job Workflow
- `GET /jobs/:jobId/history`
- `POST /jobs/:jobId/status-transitions` - owner/manager

The status machine allows:
- `NEW -> SCHEDULED | CANCELLED`
- `SCHEDULED -> IN_PROGRESS | CANCELLED`
- `IN_PROGRESS -> PENDING_REVIEW | CANCELLED`
- `PENDING_REVIEW -> COMPLETED | IN_PROGRESS | CANCELLED`
- terminal states: `COMPLETED`, `CANCELLED`

## Schedule
- `GET /jobs/schedule/day`
- `GET /jobs/schedule/range`
- `POST /jobs/schedule/conflicts` - owner/manager

Schedule APIs return lanes grouped by staff/unassigned work and include conflict flags for overlapping assigned jobs.

## Assignment
- `POST /jobs/:jobId/assign` - owner/manager
- `POST /jobs/:jobId/unassign` - owner/manager

Jobs can only be assigned to active `STAFF` memberships.

## Completion Review
- `GET /jobs/:jobId/completion-review`
- `POST /jobs/:jobId/completion-review`
- `POST /jobs/:jobId/completion-review/:reviewId/approve` - owner/manager
- `POST /jobs/:jobId/completion-review/:reviewId/return` - owner/manager

Staff can submit completion notes while a job is `IN_PROGRESS`. Submitting moves the job to `PENDING_REVIEW`. Approving moves it to `COMPLETED`; returning moves it back to `IN_PROGRESS`.

## Job Evidence
- `GET /jobs/:jobId/evidence`
- `POST /jobs/:jobId/evidence`
- `GET /jobs/:jobId/evidence/:evidenceId/download`
- `DELETE /jobs/:jobId/evidence/:evidenceId`

Evidence uploads use `multipart/form-data` with:
- `kind`
- `note`
- `file`

Supported evidence kinds:
- `SITE_PHOTO`
- `COMPLETION_PROOF`
- `CUSTOMER_DOCUMENT`
- `ISSUE_EVIDENCE`

## Team
- `GET /memberships` - owner/manager
- `PATCH /memberships/:membershipId` - owner only

Membership updates support `role` and `status`. Status can be changed to `ACTIVE` or `DISABLED`.

## Activity
- `GET /activity` - owner/manager

The activity feed is backed by `audit_logs`.

## Notifications
- `GET /notifications`
- `GET /notifications/unread-count`
- `GET /notifications/stream`
- `PATCH /notifications/:notificationId/read`
- `POST /notifications/read-all`

Notification stream events are delivered through authenticated SSE over `fetch`.

Supported notification types:
- `JOB_ASSIGNED`
- `JOB_UNASSIGNED`
- `JOB_STATUS_CHANGED`
- `JOB_COMPLETION_SUBMITTED`
- `JOB_COMPLETION_APPROVED`
- `JOB_COMPLETION_RETURNED`

## AI Dispatch Planner
- `POST /agent/conversations`
- `GET /agent/conversations`
- `GET /agent/conversations/:conversationId`
- `POST /agent/conversations/:conversationId/messages`
- `PATCH /agent/conversations/:conversationId/proposals/:proposalId`
- `POST /agent/conversations/:conversationId/proposals/:proposalId/confirm`

The planner is available to authenticated tenant users, but proposal confirmation rejects `STAFF`. Proposal review updates can resolve `customerId`, `jobId`, `membershipId`, or schedule draft fields before confirmation. Conversations, messages, tool calls, and proposals are persisted for restart recovery, multi-instance operation, and audit. Assistant responses stream over SSE and require `ANTHROPIC_API_KEY`.

## Contract Notes
- All successful JSON responses use the common `success/message/data/meta` envelope.
- Validation errors are returned as structured error details from Zod.
- Staff job visibility is restricted to assigned work.
- Job workflow, assignment, completion review, evidence, and notification actions write audit/notification records where applicable.
- Production nginx disables buffering for SSE routes.
