# Architecture

## Overview
OpsFlow is a modular monolith system using a full-stack JavaScript architecture.

## Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- TanStack Query (server state)

## Backend
- Express
- TypeScript
- Prisma ORM

## Database
- PostgreSQL

## Development Environment
- Docker Compose
  - client
  - server
  - postgres

## Architecture Style
- Modular monolith
- Feature-driven development

## Notes
- Each feature is implemented end-to-end (DB → API → UI)
- Tenant-based isolation is enforced at the data layer
