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
