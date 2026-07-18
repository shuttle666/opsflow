# Browser E2E tests

The Playwright suite focuses on two high-value system boundaries:

- the Owner → Staff → Manager workflow from dispatch through evidence and completion approval;
- proposal-first AI writes, explicit approval, conversational confirmation safeguards, and idempotent execution.

CI runs these scenarios in Chromium against a fresh PostgreSQL service. It applies migrations, seeds the database exactly once, starts the API on port `4100` and the client on port `3100`, and enables OpsFlow's guarded deterministic Fake AI provider. No external model or API key is used.

## Run against an existing development stack

With the normal Docker development stack already running on ports `3000` and `4000`:

```bash
pnpm --dir client test:e2e
```

This mode uses the existing stack and its existing data. The seeded demo accounts must be available.

The deterministic AI specs are skipped by default in this mode so the test command cannot accidentally call a real model. Use the managed-server mode below for the complete suite. If an existing API was deliberately restarted with OpsFlow's guarded Fake provider, set `PLAYWRIGHT_FAKE_AI_ENABLED=true` when running Playwright.

## Run with Playwright-managed servers

Use a fresh, disposable PostgreSQL database. Apply migrations and seed it once before starting the suite:

```bash
DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
pnpm --dir server prisma:migrate:deploy

DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
ALLOW_NON_DEV_SEED=1 \
pnpm --dir server prisma:seed

PLAYWRIGHT_START_SERVERS=true \
PLAYWRIGHT_DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
pnpm --dir client test:e2e
```

Managed mode deliberately requires `PLAYWRIGHT_DATABASE_URL`; it will not silently fall back to the development database. It also rejects non-PostgreSQL URLs, remote hosts, and database names without an explicit `e2e` segment. Playwright injects the Fake AI guard, provider, model, and disabled intent-extractor settings only into the managed API process. The suite mutates its seeded records, so recreate the disposable database before another clean run instead of reseeding a dirty database.

Failure traces, screenshots, videos, and the HTML report are written under `client/test-results` and `client/playwright-report`.
