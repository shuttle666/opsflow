# ERD

This document is aligned with `server/prisma/schema.prisma`.

## Implemented Models
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

## Core Relationships
- `User` and `Tenant` are many-to-many through `Membership`.
- `Tenant` is the data isolation boundary for customers, jobs, evidence, completion reviews, invitations, audit logs, auth sessions, and notifications.
- `Customer` belongs to one tenant and can have many jobs.
- `Job` belongs to one tenant and one customer through a tenant-safe composite customer relation.
- `Job.assignedToId` points to a user; there is no separate assignment table.
- `JobStatusHistory` records workflow transitions.
- `JobCompletionReview` records staff completion submissions and manager review outcomes.
- `JobEvidence` stores metadata for uploaded job files.
- `AuthSession` stores refresh-session state.
- `TenantInvitation` stores invitation lifecycle state.
- `AuditLog` stores tenant activity.
- `Notification` stores per-user in-app notifications.

## Important Notes
- All tenant-scoped business models include `tenant_id`.
- `Tenant` supports soft deactivation through `status` and `deleted_at`.
- `Job` keeps both legacy `scheduled_at` and current `scheduled_start_at` / `scheduled_end_at`; API and UI use the start/end window fields.
- `JobStatus` includes `PENDING_REVIEW`.
- Completion review AI fields already exist on `JobCompletionReview`, although automated AI review is not currently a primary user flow.

## Enums
- `TenantStatus`: `ACTIVE`, `DEACTIVATED`
- `MembershipRole`: `OWNER`, `MANAGER`, `STAFF`
- `MembershipStatus`: `ACTIVE`, `INVITED`, `DISABLED`
- `JobStatus`: `NEW`, `SCHEDULED`, `IN_PROGRESS`, `PENDING_REVIEW`, `COMPLETED`, `CANCELLED`
- `JobEvidenceKind`: `SITE_PHOTO`, `COMPLETION_PROOF`, `CUSTOMER_DOCUMENT`, `ISSUE_EVIDENCE`
- `JobCompletionReviewStatus`: `PENDING`, `APPROVED`, `RETURNED`
- `JobCompletionAiStatus`: `PENDING`, `APPROVED`, `NEEDS_REVIEW`, `FAILED`
- `InvitationStatus`: `PENDING`, `ACCEPTED`, `CANCELLED`, `EXPIRED`
- `NotificationType`: `JOB_ASSIGNED`, `JOB_UNASSIGNED`, `JOB_STATUS_CHANGED`, `JOB_COMPLETION_SUBMITTED`, `JOB_COMPLETION_APPROVED`, `JOB_COMPLETION_RETURNED`

## Future Candidates
- Quote
- Customer portal access model
- Payment/billing records
- External integration records

## ER Diagram

```mermaid
erDiagram
    USERS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ CUSTOMERS : owns
    USERS ||--o{ CUSTOMERS : creates
    TENANTS ||--o{ JOBS : owns
    CUSTOMERS ||--o{ JOBS : has
    USERS ||--o{ JOBS : creates
    USERS ||--o{ JOBS : assigned_to
    JOBS ||--o{ JOB_STATUS_HISTORY : records
    USERS ||--o{ JOB_STATUS_HISTORY : changes
    JOBS ||--o{ JOB_COMPLETION_REVIEWS : reviews
    USERS ||--o{ JOB_COMPLETION_REVIEWS : submits
    USERS ||--o{ JOB_COMPLETION_REVIEWS : reviews
    JOBS ||--o{ JOB_EVIDENCE : stores
    USERS ||--o{ JOB_EVIDENCE : uploads
    USERS ||--o{ AUTH_SESSIONS : owns
    TENANTS ||--o{ AUTH_SESSIONS : scopes
    TENANTS ||--o{ TENANT_INVITATIONS : has
    USERS ||--o{ TENANT_INVITATIONS : sends
    USERS ||--o{ TENANT_INVITATIONS : receives
    TENANTS ||--o{ AUDIT_LOGS : records
    USERS ||--o{ AUDIT_LOGS : acts
    TENANTS ||--o{ NOTIFICATIONS : owns
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ NOTIFICATIONS : acts

    USERS {
        uuid id
        string email
        string password_hash
        string display_name
        boolean is_active
    }

    TENANTS {
        uuid id
        string name
        string slug
        TenantStatus status
        datetime deleted_at
    }

    MEMBERSHIPS {
        uuid id
        uuid user_id
        uuid tenant_id
        MembershipRole role
        MembershipStatus status
    }

    CUSTOMERS {
        uuid id
        uuid tenant_id
        string name
        string phone
        string email
        string address
        string notes
        uuid created_by_id
    }

    JOBS {
        uuid id
        uuid tenant_id
        uuid customer_id
        string title
        JobStatus status
        uuid assigned_to_id
        uuid created_by_id
        datetime scheduled_start_at
        datetime scheduled_end_at
    }

    JOB_STATUS_HISTORY {
        uuid id
        uuid tenant_id
        uuid job_id
        JobStatus from_status
        JobStatus to_status
        uuid changed_by_id
        string reason
    }

    JOB_COMPLETION_REVIEWS {
        uuid id
        uuid tenant_id
        uuid job_id
        uuid submitted_by_id
        string completion_note
        JobCompletionReviewStatus status
        uuid reviewed_by_id
        string review_note
    }

    JOB_EVIDENCE {
        uuid id
        uuid tenant_id
        uuid job_id
        uuid uploaded_by_id
        JobEvidenceKind kind
        string file_name
        string storage_key
    }

    AUTH_SESSIONS {
        uuid id
        uuid user_id
        uuid tenant_id
        MembershipRole role
        string refresh_token_hash
        datetime expires_at
        datetime revoked_at
    }

    TENANT_INVITATIONS {
        uuid id
        uuid tenant_id
        uuid invited_by_id
        uuid invited_user_id
        string email
        MembershipRole role
        InvitationStatus status
    }

    AUDIT_LOGS {
        uuid id
        uuid tenant_id
        uuid user_id
        AuditAction action
        string target_type
        string target_id
    }

    NOTIFICATIONS {
        uuid id
        uuid tenant_id
        uuid recipient_user_id
        uuid actor_user_id
        NotificationType type
        string title
        datetime read_at
    }
```
