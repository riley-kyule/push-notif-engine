# VM Update and Cloudflare Tunnel Runbook

This runbook covers two things:

1. How to safely update the VM from GitHub without breaking the running stack.
2. How to publish the dashboard publicly through a Cloudflare Tunnel on `push.exotic-online.com`.

The deployment model stays the same:

- Ubuntu 24.04 on the VM
- PostgreSQL, Redis, nginx, PM2
- No Docker
- No direct public exposure of Node ports

## 1. Safe VM update flow

Use this workflow whenever you pull new code onto the VM.

### Before you update

Check the current process state:

```bash
pm2 status
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3000
```

If the dashboard hangs or keeps spinning:

- confirm the API health endpoint returns quickly
- confirm the dashboard is running on port `3000`
- check `pm2 logs epe-dashboard --lines 100`
- check `pm2 logs epe-api --lines 100`
- confirm `apps/dashboard/.env` contains `DASHBOARD_API_BASE_URL` and `DASHBOARD_API_TIMEOUT_MS`

The dashboard client now times out server-side API requests instead of waiting forever. The default timeout is 5000 ms.

### Pull and rebuild

Run these commands from the repo root:

```bash
git pull
npm install
cd services/api && npm run migrate && npm run build
cd ../worker && npm run build
cd ../../apps/dashboard && rm -rf .next && npm run build
cd ../..
```

The dashboard's `.next` incremental build cache has, more than once, silently
skipped recompiling a changed file (the new code never shows up even though
the build "succeeds" and the timestamp updates) -- always `rm -rf .next`
before rebuilding the dashboard rather than relying on the incremental build.

### Restart PM2 cleanly

Use the helper script rather than manually starting each service:

```bash
./scripts/pm2-restart.sh
pm2 status
```

The dashboard's Platform Health page also exposes this as a "Minor Update" (git pull + restart) / "Core Update" (the full install/build/migrate/restart flow above) button pair for super admins, with a real-time PM2 status confirmation after the restart -- useful for routine updates, but this manual runbook is still the one to follow for first-boot bootstrap, troubleshooting, and anything the buttons can't do unattended.

If this is the first boot on a fresh VM, bootstrap PM2 once:

```bash
./scripts/pm2-bootstrap.sh
pm2 save
```

### Verify after deploy

```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3000
```

Then open the dashboard and confirm:

- login works
- the overview page loads
- the worker heartbeat appears healthy
- platform health is not stuck on a loading state

## 2. Cloudflare Tunnel for public access

Use Cloudflare Tunnel when you want public access without opening inbound firewall ports for nginx or the Node services.

Recommended hostname:

- `push.exotic-online.com`

Recommended origin target:

- `http://127.0.0.1:80` when nginx is already serving the site locally

That keeps the tunnel simple:

- Cloudflare terminates public traffic
- nginx handles local reverse proxying
- the API and dashboard stay private on localhost

### Create the tunnel

Install `cloudflared` first using Cloudflare’s official installation instructions.

Then log in and create the tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create epe-push
```

This creates a tunnel credentials file and a tunnel UUID.

### Create the tunnel config

Place the tunnel config at the Cloudflare-managed location for your host, typically:

- `/etc/cloudflared/config.yml`

Example:

```yaml
tunnel: epe-push
credentials-file: /etc/cloudflared/epe-push.json

ingress:
  - hostname: push.exotic-online.com
    service: http://127.0.0.1:80
  - service: http_status:404
```

Notes:

- The `hostname` must match the public DNS name you want to use.
- The final `http_status:404` rule is required as a catch-all.
- If nginx is not installed yet, you can temporarily point the tunnel at `http://127.0.0.1:3000`, but the preferred production shape is nginx on port 80.

### Route DNS through Cloudflare

Create the DNS route for the tunnel:

```bash
cloudflared tunnel route dns epe-push push.exotic-online.com
```

Cloudflare will create the DNS record that points the hostname at the tunnel.

### Run the tunnel

For a foreground test:

```bash
cloudflared tunnel run epe-push
```

For a persistent service, install the Cloudflare service after the config is in place, then enable it through `systemctl` on the VM if your package method supports that flow.

### What should be publicly reachable

Through the tunnel, the public user should reach:

- the dashboard
- dashboard BFF routes
- any public browser SDK or service-worker assets exposed through the origin

The API should not be exposed on a separate public port unless you explicitly choose to do that later.

### Security notes

- Keep SSH restricted to your office/VPN path or a hardened allowlist.
- Do not publish `3000` or `3001` directly to the internet.
- Keep all secrets in local `.env` files only.
- If you later add Cloudflare Access, treat that as an additional layer, not a replacement for application login.

## 3. Troubleshooting

If the dashboard keeps spinning:

1. Check `curl http://127.0.0.1:3001/api/health`.
2. Check `curl http://127.0.0.1:3000`.
3. Inspect `pm2 logs epe-api --lines 100`.
4. Inspect `pm2 logs epe-dashboard --lines 100`.
5. Confirm the dashboard `.env` file points at the correct API base URL.
6. Confirm `DASHBOARD_API_TIMEOUT_MS` is set to a sane value such as `5000`.
7. Confirm you did not accidentally leak `PORT=3001` into the dashboard shell before starting it.

If the tunnel does not serve the site:

1. Check `cloudflared tunnel list`.
2. Confirm the credentials file path in `config.yml` is correct.
3. Confirm the DNS route exists.
4. Confirm nginx responds locally on port 80.
5. Re-run `cloudflared tunnel run epe-push` in the foreground and read the error output.

## 4. Related docs

- [`VM_SETUP.md`](../VM_SETUP.md)
- [`PROXMOX.md`](../PROXMOX.md)
- [`infrastructure/deployment/cpanel.md`](../infrastructure/deployment/cpanel.md)
- Cloudflare Tunnel create-remote-tunnel docs: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- Cloudflare Tunnel configuration file docs: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/

## 5. Docker Compose production topology

Production currently runs as Docker Compose. PostgreSQL and Redis use an externally isolated network; the delivery worker must join both that internal network and a dedicated egress network:

```yaml
services:
  push-worker:
    environment:
      BROWSER_PUSH_ACK_BASE_URL: "https://push.exotic-online.com/api"
      BROWSER_PUSH_SEND_CONCURRENCY: "25"
      BROWSER_PUSH_QUEUE_CONCURRENCY: "1"
      BROWSER_PUSH_TRANSIENT_FAILURE_THRESHOLD: "10"
      MOBILE_PUSH_SEND_CONCURRENCY: "200"
      MOBILE_PUSH_QUEUE_CONCURRENCY: "1"
      MOBILE_PUSH_TRANSIENT_FAILURE_THRESHOLD: "10"
    networks:
      - push_internal
      - push_egress
    dns:
      - 1.1.1.1
      - 8.8.8.8
    dns_opt:
      - timeout:2
      - attempts:5
    healthcheck:
      test: ["CMD", "node", "services/worker/dist/src/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

networks:
  push_internal:
    driver: bridge
    internal: true
  push_egress:
    driver: bridge
```

Never attach the worker only to `push_internal`. Docker networks declared with `internal: true` have no external route; the worker will still reach PostgreSQL and Redis while FCM requests fail with `getaddrinfo EAI_AGAIN`.

Before deployment, run `docker compose config -q`. Recreate the worker with `docker compose up -d --force-recreate --no-deps push-worker`, then verify DNS and HTTPS from inside the container:

```bash
docker compose exec push-worker node -e 'require("node:dns").promises.lookup("fcm.googleapis.com").then(() => console.log("DNS OK")).catch((error) => { console.error(error); process.exit(1); })'
docker compose exec push-worker node -e 'fetch("https://fcm.googleapis.com").then((response) => console.log("FCM reachable, HTTP", response.status)).catch((error) => { console.error(error); process.exit(1); })'
```

Any HTTP response from the second command proves DNS, routing, TLS, and HTTP connectivity; `404` at the FCM root is expected. The worker also probes browser FCM, Google OAuth/FCM v1, and APNs every 30 seconds and includes the results in its Redis heartbeat. Platform Health weights those signals and raises a critical alert when provider egress fails.

If transient network/provider failures reach `BROWSER_PUSH_TRANSIENT_FAILURE_THRESHOLD`, the processor opens a circuit and fails the BullMQ job. BullMQ retries up to five times with exponential backoff starting at 30 seconds. Existing idempotency skips recipients already sent successfully; if all attempts are exhausted, remaining pending delivery rows become `failed` with `INFRASTRUCTURE_RETRY_EXHAUSTED`.

Automatic pushes often target one subscriber, so a single exhausted transient
failure also fails that job immediately instead of waiting for the bulk
threshold. Native pushes use the corresponding `MOBILE_PUSH_*` limits. Both
processors reduce concurrency after provider pressure and recover gradually
after healthy batches.

Use the tracked baseline at
`infrastructure/deployment/compose.production.yaml`, then validate the running
stack:

```bash
scripts/validate-docker-deployment.sh compose.yaml
```

The API and worker must receive the same `VAPID_KEY_ENCRYPTION_KEY`. Generate it
once with `openssl rand -base64 32`, store it in both protected environment
files, and back it up securely. See
[`delivery-reliability-and-crm-callbacks.md`](delivery-reliability-and-crm-callbacks.md)
for the migration, callback, VAPID-encryption, service-worker, and verification
sequence.

### Dashboard-triggered Docker updates

The API container must not mount `/var/run/docker.sock`; that socket is
effectively root access to the host. EPE instead uses a small host-side agent
that accepts only the two update actions already exposed by the dashboard.

The installer generates `compose.updates.yaml`, which gives the API only the
request-directory bind mount and switches all application services to the
stable `exotic-push-engine:production` tag:

```yaml
environment:
  EPE_DEPLOYMENT_MODE: docker
  EPE_DEPLOYMENT_REQUEST_DIR: /deployment
volumes:
  - /srv/exotic/run/push-engine:/deployment
```

One-time host setup (the production Node image runs as UID 1000, which is the
normal first-user UID for `riley`):

```bash
test "$(id -u riley)" = "1000"
sudo ./scripts/install-docker-updater.sh
```

The base `compose.yaml` is not rewritten. Both the updater and one-time
deployment commands use
`COMPOSE_FILE=compose.yaml:compose.updates.yaml`, so the generated override is
merged predictably with the existing production stack.

The agent:

1. Refuses to deploy over modified tracked files.
2. Fetches and fast-forwards to `origin/main`.
3. Builds `infrastructure/deployment/Dockerfile` with the deployed commit baked
   into the image.
4. Validates Compose and runs the migration container.
5. Recreates only API, dashboard, and worker application containers.
6. Runs `scripts/validate-docker-deployment.sh`.
7. Writes atomic progress and final service health back to the dashboard.

`Minor Update` uses Docker's build cache. `Core Update` pulls the PostgreSQL and
Redis base images and builds the application image with `--pull --no-cache`.
The active request id is stored in the browser, so polling resumes after the
dashboard container restarts.

Troubleshooting:

```bash
sudo journalctl -u epe-docker-updater -n 200 --no-pager
cat /srv/exotic/run/push-engine/status.json
COMPOSE_FILE=compose.yaml:compose.updates.yaml docker compose ps
```

If the panel says the agent is unavailable, verify the bind mount, directory
ownership, `EPE_DEPLOYMENT_MODE=docker`, and the systemd service. A failed
update remains visible with its last 40KB of output.
