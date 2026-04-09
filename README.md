# OpsFlow

OpsFlow is a multi-tenant operations platform for field service teams, covering core workflows across customer management, job lifecycle tracking, team collaboration, evidence uploads, and AI-assisted dispatch planning.

## Live Demo

- App: [https://opsflow.aboutwenduo.wang](https://opsflow.aboutwenduo.wang)

## Demo Accounts

- Owner: `owner@acme.example` / `owner-password-123`
- Manager: `manager@acme.example` / `manager-password-123`
- Staff: `staff@acme.example` / `staff-password-123`

## Key Features

- Multi-tenant workspace model with tenant-scoped data isolation
- Authentication, session handling, and tenant switching
- Role-based access control for `OWNER`, `MANAGER`, and `STAFF`
- Customer management and job management workflows
- Job assignment, scheduling, and status transitions
- Team invitations and membership management
- Activity feed and audit logging
- Job evidence and document uploads
- AI-assisted dispatch workflow with human confirmation

## AI Dispatch Planner

OpsFlow includes an AI-powered dispatch planner designed for operational workflows rather than generic chat.

It can help turn natural-language requests into structured dispatch proposals by:

- interpreting customer and job intent
- drafting a schedule window
- suggesting a likely assignee
- generating a structured proposal before any write happens

The final action still requires user confirmation, so AI stays inside a controlled operational flow.

## Tech Stack

- Frontend: Next.js 16, React, TypeScript, Tailwind CSS
- Backend: Express, TypeScript, Prisma, PostgreSQL
- State and Validation: Zustand, TanStack Query, React Hook Form, Zod
- AI: Anthropic SDK, SSE streaming responses
- Infrastructure: AWS EC2, Amazon RDS, Docker Compose, Nginx, Certbot

## Deployment

The project is currently deployed on AWS:

- application services running on EC2
- PostgreSQL hosted on Amazon RDS
- containerized services managed with Docker Compose
- HTTPS served through Nginx and Certbot

## Local Development

### Project Structure

- `client` - Next.js application
- `server` - Express API
- `docs` - product, architecture, ERD, and planning notes

### Start With Docker

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

### Useful Commands

```bash
cd client && pnpm build && pnpm lint
cd client && pnpm test
cd server && pnpm typecheck && pnpm build && pnpm test
cd server && pnpm prisma:migrate:deploy && pnpm prisma:seed
cd server && pnpm db:reset
```

### Local Ports

- Client: `http://localhost:3000`
- Server: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
