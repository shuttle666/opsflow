# Browser E2E tests

The Playwright suite keeps a compact coverage map around deployable workflows:

- [`auth.spec.ts`](auth.spec.ts) verifies the seeded Owner sign-in path;
- [`customer-job.spec.ts`](customer-job.spec.ts) covers the representative Customer → Job CRUD path;
- [`role-workflow.spec.ts`](role-workflow.spec.ts) covers Owner → Staff → Manager from dispatch through Evidence and completion approval;
- [`agent-proposal.spec.ts`](agent-proposal.spec.ts) covers proposal-first AI writes, explicit approval, conversational-confirmation safeguards, and idempotent execution;
- [`accessibility.spec.ts`](accessibility.spec.ts) runs an axe smoke check on the landing page, sign-in, and authenticated Dashboard with a Pixel 7 profile.

CI runs these scenarios in Chromium against a fresh PostgreSQL service. It applies migrations, seeds the database exactly once, starts the API on port `4100` and the client on port `3100`, and enables OpsFlow's guarded deterministic Fake AI provider. No external model or API key is used.

## Run against an existing development stack

With the normal Docker development stack already running on ports `3000` and `4000`:

```bash
pnpm --dir client test:e2e
```

This mode uses the existing stack and its existing data. The complete development seed fixture—not only the three demo accounts—must be available because workflows also depend on known Customers, Staff memberships, and operational records.

The deterministic AI specs are skipped by default in this mode so the test command cannot accidentally call a real model. Use the managed-server mode below for the complete suite. If an existing API was deliberately restarted with OpsFlow's guarded Fake provider, set `PLAYWRIGHT_FAKE_AI_ENABLED=true` when running Playwright.

## Run with Playwright-managed servers

Use a fresh, disposable PostgreSQL database. Apply migrations and seed it once before starting the suite:

```bash
DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
pnpm --dir server prisma:migrate:deploy

DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
E2E_SEED=1 \
pnpm --dir server prisma:seed

PLAYWRIGHT_START_SERVERS=true \
PLAYWRIGHT_DATABASE_URL='postgresql://opsflow:opsflow@127.0.0.1:5432/opsflow_e2e?schema=public' \
pnpm --dir client test:e2e
```

`E2E_SEED=1` and managed Playwright independently fail closed unless their database URL targets PostgreSQL on a loopback host, contains an explicit `e2e` database-name segment, and has no query-string `host` override. Playwright never silently falls back to the development database. Use the same URL for migration, seed, and `PLAYWRIGHT_DATABASE_URL`; the Playwright preflight cannot protect a separate migration command aimed at a different database.

Managed Playwright injects the Fake AI guard, provider, model, disabled intent-extractor setting, and empty real-provider keys only into the test API process. The suite uses one worker because every scenario shares the bounded seeded demo identities. It mutates seeded records, so recreate the disposable database before another clean run instead of reseeding a dirty database.

Failure traces, screenshots, videos, isolated E2E Evidence files, and the HTML report are written under `client/test-results` and `client/playwright-report`; axe results are attached to the Playwright report.

The axe scenario blocks serious and critical automated WCAG findings on representative phone-sized surfaces. It is a smoke check, not a claim of complete keyboard or screen-reader accessibility. See the repository [Testing Strategy](../../docs/engineering/testing.md) for test layering and deliberate limits.
