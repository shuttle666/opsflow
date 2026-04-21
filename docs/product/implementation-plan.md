# Implementation Plan

This plan reflects the current state of the repository. Older Phase 3-8 implementation notes have been folded into the roadmap because those phases are now implemented.

## Verified Baseline
- The app is organized as a full-stack TypeScript monorepo with `client`, `server`, `docs`, and `infra`.
- Authentication, tenant context, RBAC, refresh sessions, and tenant invitations are implemented.
- Core operations are implemented: customers, jobs, assignment, staff workspace, workflow history, activity feed, evidence uploads, schedule calendar, completion reviews, notifications, and AI dispatch planning.
- Prisma models currently include `User`, `Tenant`, `Membership`, `Customer`, `Job`, `JobStatusHistory`, `JobCompletionReview`, `JobEvidence`, `AuthSession`, `TenantInvitation`, `AuditLog`, `Notification`, and persisted agent conversation/proposal records.
- CI runs client and server validation through GitHub Actions; production deployment is handled by the deploy workflow and the script under `infra/scripts`.

## Near-Term Work

### 1. Dashboard Hardening
Goal: replace placeholder dashboard cards with real tenant data.

- Add `GET /api/dashboard/summary`.
- Return customer count, job counts by status, today/upcoming schedule, pending invitations, active staff count, and recent activity.
- Replace placeholder revenue and crew values in the dashboard UI.
- Add role-aware dashboard states for owner/manager and staff.
- Add server integration tests and client smoke tests.
- Update `docs/engineering/api-design.md`, `docs/engineering/openapi.yaml`, and `docs/product/roadmap.md` when complete.

### 2. Production Hardening
Goal: improve reliability and operational visibility before adding larger product areas.

- Add request IDs.
- Add structured request/application logs.
- Add rate limiting for auth and write-heavy endpoints.
- Add a consistent production error taxonomy for expected domain errors.
- Document migration, seed, deploy, and rollback procedures.

### 3. Evidence Storage Upgrade
Goal: make uploaded job evidence portable across deployment targets.

- Keep the existing storage abstraction.
- Add an S3-compatible implementation.
- Add configuration for local vs object storage.
- Add tests for storage key generation and download behavior.

### 4. Customer Portal Discovery
Goal: decide whether the next major product surface should include external customer access.

- Define customer portal authentication and tenant boundaries.
- Decide which job fields are customer-visible.
- Plan service-request intake, uploads, status tracking, messaging, and feedback.

## Working Rules
- Code remains the source of truth; docs should be updated in the same change as user-facing behavior, API routes, schema changes, or deployment path changes.
- New API endpoints should be added to both `api-design.md` and `openapi.yaml`.
- New Prisma models or enum values should be reflected in `erd.md`.
- New product phases should be reflected in `roadmap.md`.
- UI-only design experiments belong under `docs/design`.
