# OpsFlow

OpsFlow is a multi-tenant operations platform for field service teams, covering core workflows across customer management, job lifecycle tracking, team collaboration, evidence uploads, and AI-assisted dispatch planning.

## Live Demo

- App: [https://opsflow.aboutwenduo.wang](https://opsflow.aboutwenduo.wang)

## Demo Accounts

- Owner: `owner@acme.example` / `owner-password-123`
- Manager: `manager@acme.example` / `manager-password-123`
- Staff: `staff@acme.example` / `staff-password-123`
- Additional local staff: `staff02@acme.example` through `staff10@acme.example` / `staff-password-123`

## Key Features

- Multi-tenant workspace model with tenant-scoped data isolation
- Authentication, session handling, and tenant switching
- Role-based access control for `OWNER`, `MANAGER`, and `STAFF`
- Customer management and job management workflows
- Job assignment, scheduling, and status transitions
- Completion review flow for staff submission and manager approval
- Team invitations and membership management
- Activity feed and audit logging
- Job evidence and document uploads
- In-app notifications with unread state and SSE updates
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
- CI/CD: GitHub Actions, SSH-based production deployment, health checks, rollback support

## Deployment

The project is currently deployed on AWS:

- application services running on EC2
- PostgreSQL hosted on Amazon RDS
- containerized services managed with Docker Compose
- HTTPS served through Nginx and Certbot

### Production Demo Data

The public demo uses the same core login accounts as local development, but it resets to a smaller data set: about 6 team members, 10 customers, and 20 jobs. The reset is tenant-scoped to `Acme Home Services`, so visitor-created tenants are not deleted.

GitHub Actions runs the reset workflow daily and it can also be triggered manually from the Actions tab. The workflow SSHs into EC2 and runs:

```bash
DEPLOY_PATH=/path/to/opsflow infra/scripts/reset-demo-data.sh
```

The production demo reset requires `DEMO_SEED_CONFIRM=reset-production-demo` internally and only refreshes the fixed demo tenant.

## Local Development

### Project Structure

- `client` - Next.js application
- `server` - Express API
- `docs` - product, engineering, and design documentation
- `infra` - deployment, nginx, and production operations assets

### Start With Docker

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

### Start In Detached Mode

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

### Stop The Development Environment

```bash
docker compose -f docker-compose.dev.yml down
```

### Useful Commands

```bash
cd client && pnpm build && pnpm lint
cd client && pnpm test
cd server && pnpm typecheck && pnpm build && pnpm test
cd server && pnpm prisma:migrate:deploy && pnpm prisma:seed
cd server && pnpm db:reset
```

### Development Seed Data

The Prisma seed is development-only demo data for the Docker/local PostgreSQL database. It resets the database and creates one `Acme Home Services` tenant with demo accounts, around 80 customers, around 250 jobs, archived customers, cancelled jobs, status history, completion reviews, and audit activity.

Job dates are generated relative to the day the seed runs, so scheduled and in-progress work stays current when you reseed later. To reproduce a specific date window, set `DEMO_SEED_BASE_DATE`:

```bash
docker compose -f docker-compose.dev.yml up --build -d
cd server && pnpm db:reset
DEMO_SEED_BASE_DATE=2026-04-21 pnpm prisma:seed
```

The seed refuses to run against non-default database URLs unless `ALLOW_NON_DEV_SEED=1` is set. Use that override only for a known safe development database.

To test the production-sized demo seed against a safe local database:

```bash
cd server
DEMO_SEED_CONFIRM=reset-production-demo pnpm demo:seed:production
```

### Local Ports

- Client: `http://localhost:3000`
- Server: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
