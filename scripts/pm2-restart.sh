#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p logs

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed or not on PATH."
  exit 1
fi

# This script is itself invoked (via the deployment actions panel) by a
# request that's handled by epe-api and relayed through epe-dashboard --
# both of which are restarted below. Running that restart inline would kill
# the very processes sending this request's HTTP response before it reaches
# the browser. Detach it and delay a few seconds so the response has time to
# land first.
#
# `pm2 restart ecosystem.config.js` reuses each process's cached exec_path
# rather than re-resolving `script` from the config -- so after a clean
# node_modules reinstall changes where a binary (e.g. next) resolves to, the
# dashboard process keeps launching the old, now-missing path. `pm2 delete`
# + `pm2 start` forces re-resolution, and `pm2 save` persists the corrected
# path so a server reboot doesn't revert to the stale one.
nohup bash -c "sleep 5 && pm2 delete ecosystem.config.js && pm2 start ecosystem.config.js --update-env && pm2 save" >> "$ROOT_DIR/logs/pm2-restart.log" 2>&1 < /dev/null &
disown

echo "PM2 restart of epe-api, epe-worker, and epe-dashboard scheduled in 5 seconds."
echo "Check logs/pm2-restart.log or run 'pm2 status' after a few seconds to confirm."
