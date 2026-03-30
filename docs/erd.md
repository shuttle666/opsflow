# ERD (Phase 2 - Core Models)

## Implemented Models
- User
- Tenant
- Membership
- Customer
- Job
- JobStatusHistory
- JobEvidence

## Relationships

- A User can have many Memberships
- A Tenant can have many Memberships
- A Membership belongs to one User and one Tenant
- A Tenant can have many Customers
- A Customer belongs to one Tenant
- A Tenant can have many Jobs
- A Customer can have many Jobs
- A Job can have many JobStatusHistory records
- A Job can have many JobEvidence records

## Notes
- User ↔ Tenant is a many-to-many relationship via Membership
- Tenant is the data isolation boundary
- All business entities must include tenant_id
- Tenant uses soft delete fields (`status`, `deleted_at`)
- Job references Customer using a composite tenant-safe relation (`customer_id`, `tenant_id`)

## Planned Models (Future)
- Quote
- Assignment
- Notification

## ER Diagram (Mermaid)

Use Mermaid syntax like below:

erDiagram
    USERS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ MEMBERSHIPS : has
    TENANTS ||--o{ CUSTOMERS : owns
    TENANTS ||--o{ JOBS : owns
    CUSTOMERS ||--o{ JOBS : has
    JOBS ||--o{ JOB_STATUS_HISTORY : records
    JOBS ||--o{ JOB_EVIDENCE : stores

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

    JOBS {
        string id
        string tenant_id
        string customer_id
        string status
    }

    JOB_STATUS_HISTORY {
        string id
        string tenant_id
        string job_id
        string from_status
        string to_status
    }

    JOB_EVIDENCE {
        string id
        string tenant_id
        string job_id
        string uploaded_by_id
        string kind
        string file_name
    }
