# OpsFlow

OpsFlow is a full-stack operations platform foundation with a Next.js client, an Express API, and lightweight planning docs. The project now includes a multi-tenant data layer, auth + RBAC, customer/job workflows, team assignment, live workflow timeline + activity feed, and job evidence uploads for field proof and completion documents.

## Project Structure

- `client` - Next.js 16 app with TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, and TanStack Query.
- `server` - Express + TypeScript API foundation with middleware, health checks, env validation, and Prisma preparation.
- `docs` - Placeholder product, architecture, API, ERD, and roadmap notes.

## Stack Summary

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, TanStack Query
- Backend: Express, TypeScript, dotenv, Zod, cors, helmet, morgan
- Database: PostgreSQL + Prisma 7 with adapter-based runtime connection (`@prisma/adapter-pg` + `pg`)
- Data layer delivered: `User`, `Tenant`, `Membership`, `Customer`, `Job`, `JobStatusHistory`, migration, and seed
- Business modules delivered: Auth, invitations, customer management, job management, team assignment flows, workflow/activity surfaces, and job evidence/document uploads
- Local development: Docker Compose with `client`, `server`, and `postgres` services

## Getting Started

### Client

```bash
cd client
pnpm install
pnpm dev
```

### Server

```bash
cd server
pnpm install
cp .env.example .env
pnpm dev
```

### Useful Commands

```bash
cd client && pnpm build && pnpm lint
cd client && pnpm test
cd server && pnpm typecheck && pnpm build && pnpm test
cd server && pnpm prisma:migrate:deploy && pnpm prisma:seed
cd server && pnpm db:reset
```

## Frontend Auth Demo (Phase 2.2)

Manual demo chain for the current frontend implementation:

1. User A opens `/register`, creates an account, and is auto-signed in.
2. User A opens `/dashboard`, creates an invitation by email, and can manage it from the invitation list (resend/cancel).
3. User B signs in (or registers with the invited email).
4. User B opens `/dashboard`, sees the pending invitation in the in-app invitation inbox, and accepts it in one click.
5. User B sees updated tenant membership context and can switch tenant from the header selector.

Notes:

- This is a manual demo flow, not an automatic chained workflow.
- Primary invitation UX is in-app inbox based; token accept page is kept only as compatibility fallback.
- No email delivery is implemented in this phase.

## Docker Development

### Docker Files Added

- `docker-compose.dev.yml` - Runs the full local development stack with `client`, `server`, and `postgres`.
- `client/Dockerfile.dev` - Development image for the Next.js app using `pnpm`.
- `server/Dockerfile.dev` - Development image for the Express API using `pnpm`.
- `client/.dockerignore` and `server/.dockerignore` - Keep Docker build context small and avoid copying local artifacts.
- `.env.example` - Root-level compose variables for ports and PostgreSQL credentials.

### What `docker-compose.dev.yml` Does

- Starts the client on port `3000`.
- Starts the server on port `4000`.
- Starts PostgreSQL on port `5432`.
- Mounts the local `client` and `server` source directories into the containers.
- Uses named volumes for container-only `node_modules` so host dependencies do not interfere.
- Uses a named volume for PostgreSQL data persistence.

### Start The Development Environment

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

### Stop And Remove PostgreSQL Data Volume

Use this only if you want to reset the local database data completely.

```bash
docker compose -f docker-compose.dev.yml down -v
```

### Hot Reload Behavior

- Client hot reload works through the Next.js development server running inside the `client` container with the project source bind-mounted from the host.
- Server hot reload works through `tsx watch` running inside the `server` container with the project source bind-mounted from the host.
- Source code changes on your machine are reflected inside the containers immediately.

### Ports

- Client: `http://localhost:3000`
- Server: `http://localhost:4000`
- PostgreSQL: `localhost:5432`

### PostgreSQL Persistence

- PostgreSQL uses the named Docker volume `postgres_data`.
- Your database state survives container restarts until you explicitly remove the volume.

### pnpm In The Docker Workflow

- Both app containers use `pnpm`, not npm or yarn.
- Each dev container runs `pnpm install --frozen-lockfile` before starting its dev server.
- Named volumes are mounted for each container's `node_modules` directory so host-side modules never override container dependencies.

### Bind Mount And `node_modules` Notes

- `./client` is mounted into `/app` in the `client` container.
- `./server` is mounted into `/app` in the `server` container.
- `/app/node_modules` is a Docker-managed named volume in each container, which avoids common cross-platform module issues.

## Production Deployment On A Single EC2

This repository now includes a production-oriented Docker Compose setup for a single EC2 host with an external PostgreSQL database such as Amazon RDS:

- `client/Dockerfile` - Multi-stage production image for the Next.js app.
- `server/Dockerfile` - Multi-stage production image for the Express + Prisma API.
- `docker-compose.prod.yml` - Runs `server`, `client`, `nginx`, and an on-demand `certbot` service against an external PostgreSQL database.
- `deploy/nginx/` - Bootstrap + HTTPS nginx configuration for `app` and `api` subdomains.
- `.env.production.example` - Template for required production environment variables.

### Production Services

- `server` connects to an external PostgreSQL database through `DATABASE_URL`.
- `server` stores uploaded evidence under the host path configured by `SERVER_UPLOADS_DIR`.
- `client` is built with `NEXT_PUBLIC_API_URL` pointing at the public API domain.
- `nginx` is the public entrypoint on ports `80` and `443`.
- `certbot` is kept for manual certificate issuance and renewal commands.

### First-Time EC2 Setup

1. Provision an EC2 instance, install Docker Engine + Docker Compose plugin, and open ports `22`, `80`, and `443`.
2. Provision an external PostgreSQL database such as Amazon RDS, and allow inbound access from the EC2 instance on port `5432`.
3. Point your DNS records at the EC2 public IP:
   - `app.your-domain.com`
   - `api.your-domain.com`
4. Copy `.env.production.example` to `.env.production` and replace every placeholder value.
5. Create the uploads directory defined by `SERVER_UPLOADS_DIR` (for example `sudo mkdir -p /srv/opsflow/uploads`).

### Start The Production Stack

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build server client nginx
```

### Run Database Migrations

Run this after the containers are up and any time a new migration is deployed. Make sure `DATABASE_URL` points at the target RDS instance before running it:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server pnpm prisma:migrate:deploy
```

### Issue The Initial HTTPS Certificate

The nginx container starts in HTTP bootstrap mode until a certificate exists. After DNS is pointing at the EC2 instance and port 80 is reachable, request the certificate:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certbot run --rm certbot certonly --webroot -w /var/www/certbot --email you@example.com --agree-tos --no-eff-email --cert-name opsflow -d app.your-domain.com -d api.your-domain.com
```

After the certificate is issued, restart nginx so it switches to the HTTPS configuration:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart nginx
```

### Renew Certificates

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certbot run --rm certbot renew --webroot -w /var/www/certbot
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Smoke Checks

- Frontend: `https://app.your-domain.com`
- API health: `https://api.your-domain.com/api/health`
- Container logs: `docker compose --env-file .env.production -f docker-compose.prod.yml logs -f`
