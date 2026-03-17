# API Design (Phase 3 - Planned)

## Auth

POST /auth/register  
POST /auth/login  
GET /auth/me  

## Tenant

POST /tenants  
GET /tenants/current  

## Customers

POST /customers  
GET /customers  
GET /customers/:id  
PATCH /customers/:id  

## Notes

- All APIs will be tenant-scoped
- Authentication will use JWT
- Authorization will be role-based (RBAC)
- API responses will follow a consistent structure
