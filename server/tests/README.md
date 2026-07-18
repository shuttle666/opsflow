# Tests

## Run

```bash
pnpm test
```

By default, DB integration tests are skipped.

To run integration coverage against PostgreSQL:

```bash
RUN_DB_TESTS=true ALLOW_DB_TEST_RESET=true pnpm test
```

## Deterministic AI provider

Browser and integration tests can exercise the real Agent loop and Tool Registry
without an external model by opting into the narrow Fake Provider:

```bash
ALLOW_FAKE_AI_PROVIDER=true
AI_DISPATCH_PLANNER_PROVIDER=fake
AI_DISPATCH_PLANNER_MODEL=opsflow-scripted-e2e-v1
AI_INTENT_EXTRACTOR_ENABLED=false
```

The provider is rejected in production and accepts only this test command shape:

```text
[opsflow-e2e:create-job] {"customer":"Aiden Murphy","title":"E2E AI Proposal Job","serviceAddress":"18 Collins Street, Melbourne VIC 3000"}
```

It deterministically searches for one exact customer, creates a pending job
Proposal, and stops. A later allowlisted confirmation causes it to reload the
Proposal before requesting execution. Ordinary natural-language messages do not
produce tool calls.
