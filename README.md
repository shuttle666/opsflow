# OpsFlow

OpsFlow is a full-stack operations platform foundation with a Next.js client, an Express API, and lightweight planning docs. This setup intentionally stops before any PostgreSQL or Prisma data modeling so the engineering base is clean before domain work begins.

## Project Structure

- `client` - Next.js 16 app with TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, and TanStack Query.
- `server` - Express + TypeScript API foundation with middleware, health checks, env validation, and Prisma preparation.
- `docs` - Placeholder product, architecture, API, ERD, and roadmap notes.

## Stack Summary

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, TanStack Query
- Backend: Express, TypeScript, dotenv, Zod, cors, helmet, morgan
- Database prep: Prisma CLI and client installed, schema prepared, no models defined
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
cd server && pnpm typecheck && pnpm build
```

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

### Important Note

- Prisma and PostgreSQL models are intentionally not implemented yet.
- The Docker setup only prepares local infrastructure for the next phase of database and schema work.

## Notes

- Database models and migrations are intentionally not implemented yet.
- The next step can focus on PostgreSQL and Prisma data modeling without needing to restructure the app foundations.
