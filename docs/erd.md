# ERD (Phase 2 - Core Models)

## Implemented Models
- User
- Tenant
- Membership
- Customer

## Relationships

- A User can have many Memberships
- A Tenant can have many Memberships
- A Membership belongs to one User and one Tenant
- A Tenant can have many Customers
- A Customer belongs to one Tenant

## Notes
- User ↔ Tenant is a many-to-many relationship via Membership
- Tenant is the data isolation boundary
- All business entities must include tenant_id

## Planned Models (Future)
- Job
- Quote
- Attachment
- Assignment
- Notification

## ER Diagram (Mermaid)

Use Mermaid syntax like below:

erDiagram
    USERS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ CUSTOMERS : owns

    MEMBERSHIPS {
        string id
        string user_id
        string tenant_id
        string role
    }

    USERS {
        string id
        string email
    }

    TENANTS {
        string id
        string name
        string slug
    }

    CUSTOMERS {
        string id
        string tenant_id
        string name
    }
