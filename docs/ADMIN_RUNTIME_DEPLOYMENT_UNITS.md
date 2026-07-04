# Admin Runtime Deployment Units

## Goal

`googeradminpanel` now has its own standalone runtime unit so it no longer needs to be deployed only as a sidecar of `googernew-main`.

## Runtime Units

- `admin-app`
- `admin-worker`

## Explicit Service Contracts

Required runtime contracts:

- `BACKEND_URL`
- `GOOGER_MAIN_API_URL`
- `INTERNAL_SERVICE_TOKEN`
- `OPS_MONITOR_TOKEN`

## Uploads Contract

The admin runtime no longer requires a shared filesystem mount from the main app.

Behavior:

- if `UPLOADS_DIR` exists, admin serves local mounted uploads
- otherwise `/uploads/*` is proxied to `GOOGER_MAIN_API_URL`

## Run

1. Copy `.env.runtime.example` to `.env.runtime`
2. Fill real URLs, tokens, and database credentials
3. Validate with `node scripts/validate-runtime-contracts.js .env.runtime`
4. Start with `docker compose --env-file .env.runtime -f docker-compose.runtime.yml up -d --build`
