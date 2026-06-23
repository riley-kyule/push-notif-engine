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

