#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed or not on PATH."
  exit 1
fi

# Remove any stale app definitions so we always start from the repo-level
# ecosystem file and do not inherit shell variables like PORT from a prior env
# source.
pm2 delete epe-api >/dev/null 2>&1 || true
pm2 delete epe-worker >/dev/null 2>&1 || true
pm2 delete epe-dashboard >/dev/null 2>&1 || true

pm2 start ecosystem.config.js
pm2 save
pm2 status
