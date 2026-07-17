# OpsFlow PRD

## Overview
OpsFlow is a multi-tenant service operations SaaS platform for field service teams. The current product focuses on internal operations: tenant-scoped customer records, job lifecycle management, staff assignment, scheduling, evidence capture, completion review, notifications, and AI-assisted dispatch planning.

## Problem
Small service businesses often manage customers, jobs, assignments, photos, and follow-up actions across phone calls, messaging apps, spreadsheets, and ad hoc folders. That creates weak visibility, inconsistent handoffs, and limited auditability.

OpsFlow centralizes the operational workflow so owners, managers, and staff can work from the same tenant-scoped source of truth.

## Target Users
- Tenant Owner
- Manager
- Staff
- Customer, planned for a future customer-facing portal

## Implemented Scope
- Authentication: register, login, refresh, logout, current user, and tenant switching
- Multi-tenant access control with `OWNER`, `MANAGER`, and `STAFF` roles
- Tenant invitations and invitation acceptance
- Customer management with notes and recent job summaries
- Job CRUD with customer linkage, schedule windows, assignment, and staff-specific job visibility
- Job workflow history and status transitions
- Schedule calendar APIs and UI for day, week, and month planning
- Job evidence uploads, downloads, and deletion
- Completion review flow: staff submit, owner/manager approve or return for rework
- Tenant activity feed backed by audit logs
- In-app notifications with unread state and authenticated SSE streaming
- AI dispatch planner that can draft customer/job/schedule/assignee proposals and requires manager confirmation before writes
- TanStack Query-managed REST state for dashboard, customer, job, schedule, membership, activity, invitation, notification, and Agent conversation surfaces, with authorization-scoped keys and mutation-driven cache reconciliation
- Request correlation through `X-Request-Id`, stable API error codes, structured request/error logs, and request IDs on primary frontend error surfaces
- Docker Compose local development and production deployment through GitHub Actions, EC2, Nginx, and Certbot

## Current Constraints
- `GET /api/dashboard/summary` supports the shipped daily dispatch surface; broader tenant analytics such as customer totals and full job-status breakdowns are not part of the current response.
- AI planner conversations, tool traces, and proposals are persisted for restart recovery and audit.
- Job evidence uses local disk storage in the current deployment shape, with a storage abstraction that can be replaced later.
- Streaming connections, file downloads, and ephemeral UI state remain imperative or local by design rather than being forced into the server-state cache.
- Current observability is a request-level baseline written to application stdout. Centralized log aggregation, metrics, distributed tracing, and external error monitoring are not implemented.
- There is no customer-facing portal yet.

## Out Of Scope For Now
- Payments and billing
- Native mobile apps
- Advanced route optimization
- Third-party integrations
- Customer self-service portal
- A full production observability stack beyond the implemented request-correlation and structured-log baseline

## Goal
Build a production-style full-stack SaaS project that demonstrates secure multi-tenant operations, realistic service workflows, thoughtful UI, test coverage, CI/CD, and a controlled AI-assisted workflow.
