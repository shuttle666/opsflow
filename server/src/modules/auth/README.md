# Auth Module

This module owns registration, login, refresh/logout sessions, current-user and tenant-switching flows, tenant invitations, and authentication/RBAC middleware helpers.

Protected requests derive tenant context from the authenticated session rather than request payloads. Authorization-sensitive work revalidates the current user, tenant, membership status, and role so disabled memberships, role changes, deactivated tenants, and stale invitation state fail closed without waiting for an access token to expire.
