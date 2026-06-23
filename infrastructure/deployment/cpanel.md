# EPE cPanel VPS Runbook

This runbook covers the production deployment model for Exotic Push Engine on a single cPanel-managed VPS.

Non-negotiables:

- No Docker.
- No managed SaaS push providers.
- PostgreSQL, Redis, and object storage are required.
- PM2 runs the Node processes.
- nginx terminates TLS and reverse proxies to the local services.

## Runtime layout

- `epe-dashboard` on `127.0.0.1:3000`
- `epe-api` on `127.0.0.1:3001`
- `epe-worker` as a background process with no HTTP port
- PostgreSQL on the VPS or a reachable private endpoint
- Redis on the VPS or a reachable private endpoint

The deployment target is a single VPS first. The code should remain portable to multiple servers later, but the current runbook assumes one host.

## Prerequisites

Install on the VPS:

- Node.js 20+
- npm
- PM2
- nginx
- PostgreSQL client tools
- Redis server or access to a managed Redis endpoint
- `tar`
- `rsync`
- `curl`

Create a deploy user that owns the application files and PM2 process list.

## Required environment variables

Populate the `.env` files under each service directory before starting PM2:

- `services/api/.env`
- `services/worker/.env`
- `apps/dashboard/.env`

Minimum production variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `PUBLIC_API_BASE_URL`
- `PORT=3001`
- `CAMPAIGN_MEDIA_STORAGE_*`
- `BACKUP_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `NEXT_PUBLIC_API_URL`
- `DASHBOARD_API_BASE_URL`
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

Do not store secrets in the repository.

## Initial setup

1. Clone the repository onto the VPS.
2. Install dependencies from the repo root:

   ```bash
   npm install
   ```

3. Apply database migrations from the API service directory:

   ```bash
   cd services/api
   npm run migrate
   ```

4. Build the API, worker, and dashboard:

   ```bash
   cd services/api && npm run build
   cd ../worker && npm run build
   cd ../../apps/dashboard && npm run build
   ```

5. Confirm that `ecosystem.config.js` points to the correct environment files.

## Nginx

Use [`../nginx/epe.conf`](../nginx/epe.conf) as the baseline reverse-proxy configuration.

Important rules:

- Keep the `/api/dashboard/*` location above the generic `/api/*` route.
- Preserve the API prefix by proxying `/api/` to `/api/` on the Nest server.
- Redirect HTTP to HTTPS.
- Set HSTS and the usual security headers.

After editing nginx:

```bash
nginx -t
systemctl reload nginx
```

## PM2

The repo root contains [`ecosystem.config.js`](../../ecosystem.config.js).

Useful commands:

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
pm2 reload ecosystem.config.js
pm2 save
pm2 startup
```

Operational notes:

- Use `pm2 reload` for normal deploys so the processes restart cleanly.
- Use `pm2 save` after a known-good process table is running.
- Run `pm2 startup` once per VPS reboot policy and execute the command PM2 prints.
- The config file reads each service `.env` directly. Do not rely on PM2 `env_file`.

## Deployment flow

Use this sequence for a normal release:

1. Pull the latest code.
2. Install any new dependencies.
3. Build the API, worker, and dashboard.
4. Run database migrations.
5. Reload PM2.
6. Verify health endpoints.

Suggested command sequence:

```bash
git pull
npm install
cd services/api && npm run migrate && npm run build
cd ../worker && npm run build
cd ../../apps/dashboard && npm run build
cd ../..
pm2 reload ecosystem.config.js
```

## Verification checklist

After deployment, confirm:

- `GET /api/health/platform`
- `GET /api/health/storage`
- dashboard login works
- a protected dashboard page loads
- the worker shows a fresh heartbeat
- queue depth is visible in the health page
- auth cookies are being set by the dashboard BFF routes

For a deeper smoke test:

1. Log into the dashboard.
2. Create a test site.
3. Generate VAPID credentials.
4. Send a small campaign.
5. Confirm the worker processes the queue job.
6. Confirm delivery events appear in analytics.

## Rollback

If a deployment introduces a fault:

1. Reload the previous known-good code revision.
2. Rebuild the affected services.
3. Re-run migrations only if the change was forward-compatible and the rollback plan allows it.
4. Reload PM2.
5. Recheck health, auth, and worker heartbeat.

## Logs

PM2 writes logs to the paths in `ecosystem.config.js`:

- `logs/epe-api.out.log`
- `logs/epe-api.err.log`
- `logs/epe-worker.out.log`
- `logs/epe-worker.err.log`
- `logs/epe-dashboard.out.log`
- `logs/epe-dashboard.err.log`

Use them together with the platform health page when diagnosing incidents.

## Backups

The backup system is intentionally separate from the main deploy flow.

- System backups are created through the API backup module.
- Backup metadata and OAuth connections are stored in Postgres.
- Dropbox and Google Drive are supported backup destinations.
- Backup tokens are encrypted at rest.
- The dashboard backup console lives at `/platform/backup-config` and exposes provider connections, automatic schedules, recent history, and a copyable manual restore command.

If a backup fails:

1. Check the API backup logs.
2. Verify the OAuth connection in the dashboard.
3. Confirm object storage and database connectivity.
4. Retry the backup after the upstream provider is healthy.

## PM2 boot persistence validation

This verification must be run on the actual VPS after a controlled reboot.

1. Run `pm2 save` so the current process list is written to disk.
2. Confirm `pm2 jlist` shows the API, dashboard, and worker processes online.
3. Reboot the VPS.
4. After the machine comes back, run `pm2 resurrect` if needed.
5. Recheck `pm2 jlist`, the dashboard login page, the API health endpoint, and a worker heartbeat.
6. Verify the nginx proxy still routes `/api/dashboard/*` to the dashboard and `/api/*` to the API.

Pass criteria:

- All three services return to the expected state without manual process recreation.
- The dashboard loads at `/login` and `/`.
- The API and worker health checks are green.

## Security notes

- Keep the VPS behind HTTPS only.
- Restrict SSH access.
- Rotate JWT and backup secrets if compromise is suspected.
- Do not expose Redis or PostgreSQL publicly.
- Serve the dashboard and API only through nginx.

## What this runbook is not

- It is not a Docker deployment guide.
- It is not a multi-server scaling guide.
- It is not a SaaS hosting guide.

Those concerns are out of scope for the current project phase.
