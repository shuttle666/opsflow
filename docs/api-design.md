# API Design (Phase 7 - Job Evidence / Documents Live)

## Current Status

- Auth, tenant context, invitations, and RBAC APIs are already implemented.
- Customer APIs are implemented end-to-end.
- Job CRUD APIs are implemented end-to-end.
- Team membership management and job assignment APIs are now implemented.
- Job workflow APIs are now implemented, including live history, status transitions, and tenant activity feed.
- Job evidence APIs are now implemented, including upload, list, download, and delete flows scoped to the current tenant/job visibility.

## Auth

POST /auth/register  
POST /auth/login  
GET /auth/me  
POST /auth/refresh  
POST /auth/logout  
POST /auth/switch-tenant

## Tenant

POST /tenants/:tenantId/invitations  
GET /tenants/:tenantId/invitations  
POST /tenants/:tenantId/invitations/:invitationId/resend  
POST /tenants/:tenantId/invitations/:invitationId/cancel

## Customers

POST /customers  
GET /customers  
GET /customers/:id  
PATCH /customers/:id  

## Jobs

POST /jobs  
GET /jobs  (OWNER/MANAGER)  
GET /jobs/my  
GET /jobs/:id  
GET /jobs/:id/history
PATCH /jobs/:id  
POST /jobs/:id/status-transitions
POST /jobs/:id/assign  
POST /jobs/:id/unassign  
GET /jobs/:id/evidence
POST /jobs/:id/evidence
GET /jobs/:id/evidence/:evidenceId/download
DELETE /jobs/:id/evidence/:evidenceId

## Team

GET /memberships  
PATCH /memberships/:id  

## Activity

GET /activity

## Invitations

GET /invitations/mine  
POST /invitations/:id/accept  
POST /invitations/accept

## Notes

- All APIs will be tenant-scoped
- Authentication will use JWT
- Authorization will be role-based (RBAC)
- API responses will follow a consistent structure
- STAFF job visibility is now limited to assigned work via `/jobs/my`
- Workflow transitions now write both `job_status_history` and `audit_logs`
- Dashboard activity feed is driven by audit log data, not placeholder records
- Job evidence is intended for field media, completion proof, customer documents, and issue evidence rather than generic tenant file storage
