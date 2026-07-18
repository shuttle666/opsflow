# Tests

## Run

```bash
pnpm test
```

By default, DB integration tests are skipped.

To run integration coverage against PostgreSQL:

```bash
DATABASE_URL=postgresql://opsflow:opsflow@localhost:5432/opsflow_test \
RUN_DB_TESTS=true \
ALLOW_DB_TEST_RESET=true \
pnpm test
```

The test runner fails closed unless `DATABASE_URL` points to PostgreSQL on a
loopback host and the database name contains a `test` or `e2e` segment. These
tests reset every table; never point them at the development or demo database.

## Security integration coverage

- `security.api.integration.test.ts` probes cross-tenant resource IDs through
  the real HTTP middleware stack, verifies current membership and tenant state,
  correlates Request IDs with logs and Tool Invocation records, and exercises
  concurrent Proposal confirmation plus replay.
- `database-tenant-integrity.integration.test.ts` proves PostgreSQL composite
  foreign keys reject cross-tenant evidence, completion review, and status
  history writes.
- `mcp-tenant-revalidation.integration.test.ts` keeps one MCP connection open
  while the caller is demoted or disabled and while the tenant is deactivated.
- Customer and membership API suites verify Staff job visibility and protect
  the final active Owner under concurrent updates.

## Deterministic AI provider

Browser and integration tests can exercise the real Agent loop and Tool Registry
without an external model by opting into the narrow Fake Provider:

Run the guarded Fake Provider Request-ID and Proposal integration coverage with:

```bash
DATABASE_URL=postgresql://opsflow:opsflow@localhost:5432/opsflow_test \
RUN_DB_TESTS=true \
ALLOW_DB_TEST_RESET=true \
ALLOW_FAKE_AI_PROVIDER=true \
AI_DISPATCH_PLANNER_PROVIDER=fake \
AI_DISPATCH_PLANNER_MODEL=opsflow-scripted-e2e-v1 \
AI_INTENT_EXTRACTOR_ENABLED=false \
pnpm exec vitest run tests/security.api.integration.test.ts
```

The provider is rejected in production and accepts only this test command shape:

```text
[opsflow-e2e:create-job] {"customer":"Aiden Murphy","title":"E2E AI Proposal Job","serviceAddress":"18 Collins Street, Melbourne VIC 3000"}
```

It deterministically searches for one exact customer, creates a pending job
Proposal, and stops. A later allowlisted confirmation causes it to reload the
Proposal before requesting execution. Ordinary natural-language messages do not
produce tool calls.
