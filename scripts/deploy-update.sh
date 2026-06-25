#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed or not on PATH."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed or not on PATH."
  exit 1
fi

npm install
npm run build --workspace @epe/api
npm run build --workspace @epe/worker
npm run build --workspace @epe/dashboard
npm run migrate --workspace @epe/api
"$ROOT_DIR/scripts/pm2-restart.sh"
