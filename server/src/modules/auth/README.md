# Auth Module

This module owns registration, login, refresh/logout sessions, current-user and tenant-switching flows, tenant invitations, and authentication/RBAC middleware helpers.

Protected requests derive tenant context from the authenticated session rather than request payloads. Authorization-sensitive work revalidates the current user, tenant, membership status, and role so disabled memberships, role changes, deactivated tenants, and stale invitation state fail closed without waiting for an access token to expire.

`POST /api/auth/demo-session` is the public, rate-limited private-demo entry point. It creates a temporary User and Tenant with the versioned Golden Demo scenario, returns the normal authentication payload, and caps the refresh session/cookie at the workspace expiry. Temporary users cannot use ordinary login, invitations, tenant switching, or membership administration. Expired workspaces fail access and refresh validation and are removed by bounded, lease-based cleanup without touching the legacy shared demo tenant.
