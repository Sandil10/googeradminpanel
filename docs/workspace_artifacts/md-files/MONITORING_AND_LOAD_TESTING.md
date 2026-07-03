# Monitoring and Load Testing

## Monitoring endpoints

Protected by one of:
- `OPS_MONITOR_TOKEN`
- `INTERNAL_SERVICE_TOKEN`
- `MAIN_APP_INTERNAL_TOKEN`
- `GOOGER_INTERNAL_SERVICE_TOKEN`

Send the token in:
- `Authorization: Bearer <token>`
- or `x-ops-monitor-token: <token>`

### Main app
- `GET /api/health`
- `GET /api/ops/health`
- `GET /api/ops/metrics`

### Admin app
- `GET /api/health`
- `GET /api/ops/health`
- `GET /api/ops/metrics`

## What `/api/ops/health` tells you

- DB reachable or not
- failed queue jobs exist or not
- stale workers exist or not
- queue totals
- worker totals

Status rules:
- `200` = healthy
- `503` = degraded because failed jobs or stale workers were found
- `500` = monitoring query failed

## What `/api/ops/metrics` gives you

- queue-by-queue counts
- pending/running/failed/completed totals
- oldest pending job age
- worker list
- worker heartbeat age
- stale worker flag
- last worker error

## Worker stale threshold

Default:
- `WORKER_STALE_AFTER_SECONDS=120`

Tune this higher if a job can legitimately run for longer without another heartbeat.

## Load test script

Both apps now have:
- `npm run loadtest`

The script uses these env vars:
- `LOAD_TEST_BASE_URL`
- `LOAD_TEST_PATHS`
- `LOAD_TEST_METHOD`
- `LOAD_TEST_SCENARIO_FILE`
- `LOAD_TEST_SCENARIO_JSON`
- `LOAD_TEST_CONCURRENCY`
- `LOAD_TEST_DURATION_SECONDS`
- `LOAD_TEST_TIMEOUT_MS`
- `LOAD_TEST_WARMUP_SECONDS`
- `LOAD_TEST_HEADERS`
- `LOAD_TEST_BODY`

## Scenario files

Ready-made scenarios live in:
- `shared/load-test-scenarios/main-public-mixed.json`
- `shared/load-test-scenarios/admin-public-mixed.json`
- `shared/load-test-scenarios/main-authenticated-template.json`
- `shared/load-test-scenarios/ops-monitoring-template.json`

The scenario loader supports `${ENV_VAR}` placeholders inside JSON.

## Example runs

### Main app public mixed traffic

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:5000'
$env:LOAD_TEST_SCENARIO_FILE='c:\Users\Administrator\Documents\new\shared\load-test-scenarios\main-public-mixed.json'
$env:LOAD_TEST_CONCURRENCY='100'
$env:LOAD_TEST_DURATION_SECONDS='30'
npm run loadtest
```

### Admin app public mixed traffic

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:3002'
$env:LOAD_TEST_SCENARIO_FILE='c:\Users\Administrator\Documents\new\shared\load-test-scenarios\admin-public-mixed.json'
$env:LOAD_TEST_CONCURRENCY='100'
$env:LOAD_TEST_DURATION_SECONDS='30'
npm run loadtest
```

### Protected ops metrics endpoint

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:5000'
$env:LOAD_TEST_SCENARIO_FILE='c:\Users\Administrator\Documents\new\shared\load-test-scenarios\ops-monitoring-template.json'
$env:LOAD_TEST_CONCURRENCY='25'
$env:LOAD_TEST_DURATION_SECONDS='20'
npm run loadtest
```

### Authenticated main-app reads

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:5000'
$env:LOAD_TEST_AUTH_TOKEN='REPLACE_WITH_TEST_USER_TOKEN'
$env:LOAD_TEST_SCENARIO_FILE='c:\Users\Administrator\Documents\new\shared\load-test-scenarios\main-authenticated-template.json'
$env:LOAD_TEST_CONCURRENCY='50'
$env:LOAD_TEST_DURATION_SECONDS='20'
npm run loadtest
```

## Concurrency targets to test

Run these in order:
1. `100`
2. `300`
3. `500`

## Suggested proof sequence

1. Main public mixed
2. Admin public mixed
3. Ops monitoring mixed
4. Main authenticated read mixed
5. Sensitive write tests in a separate staging dataset only

Do not begin wallet/order/subscription write stress on production data without disposable seeded accounts.

For each run, record:
- p50 latency
- p95 latency
- p99 latency
- requests/sec
- error rate
- queue backlog growth
- failed jobs count
- stale workers count

## Pass/fail guidance

Good enough for the next phase:
- error rate below `1%`
- no stale workers
- no steady growth in pending queue depth
- p95 health/readonly endpoints below `500ms`
- sensitive write endpoints remain stable under expected business load

If the queue grows and never recovers, add more worker processes before scaling API traffic.
