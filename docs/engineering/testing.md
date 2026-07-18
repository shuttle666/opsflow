# Testing Strategy

OpsFlow uses a small number of layered checks chosen around product and security boundaries. The goal is not a large test count; it is inspectable evidence that tenant isolation, role workflows, AI approval, persistence, and the deployable application work together.

## Verification Layers

| Layer | Tooling and scope | CI job |
| --- | --- | --- |
| Client unit and component | Vitest, Testing Library, query-cache behavior, error states, forms, and UI permissions | `client-ci` |
| Server unit and contract | Vitest, domain rules, schemas, Tool Registry, MCP contract, and deterministic provider behavior | `server-ci` |
| HTTP and database integration | Supertest plus real PostgreSQL for middleware authorization, Request ID correlation, transaction races, and tenant constraints | `server-db-integration` |
| Browser workflow | Playwright Chromium against production builds for auth, CRUD smoke, the three-role operational loop, and safe AI writes | `playwright-e2e` |
| Mobile accessibility smoke | Playwright with a Pixel 7 profile and axe on the public landing page, sign-in, and authenticated Dashboard | `playwright-e2e` |

The workflow definition is [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Pull requests and pushes to `main` run linting, type checking, unit/contract tests, builds, PostgreSQL integration, and browser E2E.

## High-value Scenarios

- [Owner → Staff → Manager](../../client/e2e/role-workflow.spec.ts): an Owner creates, assigns, and schedules work; assigned Staff starts it, uploads completion evidence, and submits it; a Manager reviews the handoff and approves completion.
- [Safe AI writes](../../client/e2e/agent-proposal.spec.ts): deterministic model output creates a pending Proposal, explicit human confirmation executes it, conversational questions are rejected, and replay does not duplicate the mutation.
- [API security](../../server/tests/security.api.integration.test.ts): cross-tenant identifiers fail through the HTTP stack, stale authorization is rejected, Request IDs correlate responses/logs/invocations, and concurrent Proposal confirmation remains idempotent.
- [Database tenant integrity](../../server/tests/database-tenant-integrity.integration.test.ts): composite foreign keys reject cross-tenant Evidence, Completion Review, and Status History records even if application code is bypassed.
- [Live MCP authorization](../../server/tests/mcp-tenant-revalidation.integration.test.ts): an open MCP process loses access immediately after role, membership, or tenant state changes.
- [Membership concurrency](../../server/tests/membership.api.integration.test.ts) and [invitation acceptance](../../server/tests/auth-invitation.service.unit.test.ts): concurrent updates cannot remove the final active Owner, and acceptance revalidates the live invitation and tenant state.

## Determinism And Isolation

- CI creates a fresh `opsflow_e2e` PostgreSQL service, applies migrations, and seeds the complete development fixture once.
- Managed browser tests use dedicated ports `3100` and `4100`, production builds in CI, one worker, and unique data for retries.
- The Fake AI provider is accepted only behind an explicit non-production guard and a narrow scripted input. Managed test services clear Anthropic and OpenAI keys, so the suite cannot call a real model.
- E2E database URLs must use PostgreSQL on a loopback host with an explicit `e2e` database-name segment. Both the seed path and Playwright startup reject query-string `host` overrides.
- Uploaded E2E Evidence is written under `client/test-results/evidence`, isolated from normal development files and included with failure artifacts.
- Traces, screenshots, videos, axe JSON, and the HTML report are retained when useful for diagnosis.

## Local Execution

Run fast validation from the repository root:

```bash
pnpm --dir client lint
pnpm --dir client typecheck
pnpm --dir client test
pnpm --dir server typecheck
pnpm --dir server test
```

Database integration tests and managed Playwright mutate disposable databases and therefore require explicit opt-in. Follow [server test setup](../../server/tests/README.md) and [browser E2E setup](../../client/e2e/README.md); do not point either suite at development, demo, or production data.

## Deliberate Limits

The browser suite prioritizes representative business boundaries rather than testing every page permutation. The mobile axe scenario is an automated smoke check, not a substitute for keyboard, screen-reader, or manual accessibility review. Full cross-browser coverage, performance/load testing, chaos testing, and production synthetic monitoring are not claimed in the current portfolio scope.
