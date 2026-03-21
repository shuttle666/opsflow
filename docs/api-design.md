# API Design (Phase 6 - Workflow + Activity Live)

## Current Status

- Auth, tenant context, invitations, and RBAC APIs are already implemented.
- Customer APIs are implemented end-to-end.
- Job CRUD APIs are implemented end-to-end.
- Team membership management and job assignment APIs are now implemented.
- Job workflow APIs are now implemented, including live history, status transitions, and tenant activity feed.

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
