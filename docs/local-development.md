# Local Development

## Required Services

The backend requires:

* PostgreSQL
* Redis

## Environment Variables

### API

Copy `services/api/.env.example` to `services/api/.env` and set:

* `DATABASE_URL`
* `REDIS_URL`
* `CORS_ORIGINS` for local dashboard access
* `JWT_ACCESS_SECRET`
* `JWT_REFRESH_SECRET`

### Worker

Copy `services/worker/.env.example` to `services/worker/.env` and set:

* `DATABASE_URL`
* `REDIS_URL`
* `BROWSER_PUSH_ACK_BASE_URL` if the worker cannot infer the API base URL

### Dashboard

Copy `apps/dashboard/.env.example` to `apps/dashboard/.env.local` if you want the dashboard to talk directly to the API.

## Start Order

1. Start PostgreSQL.
2. Start Redis.
3. Run database migrations.
4. Start the API.
5. Start the worker.
6. Start the dashboard.

## Commands

* `npm run dev --workspace @epe/api`
* `npm run dev --workspace @epe/worker`
* `npm run dev --workspace @epe/dashboard`

## Notes

* The dashboard includes same-origin fallback API routes for local UX development.
* The Nest API is still the source of truth for production data and queue processing.
