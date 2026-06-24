#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed or not on PATH."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required to install the PM2 startup hook."
  exit 1
fi

USER_NAME="${SUDO_USER:-$(whoami)}"
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"

if [[ -z "$HOME_DIR" ]]; then
  echo "Unable to resolve home directory for $USER_NAME."
  exit 1
fi

sudo env PATH="$PATH" pm2 startup systemd -u "$USER_NAME" --hp "$HOME_DIR"
pm2 save

echo "PM2 startup hook enabled for $USER_NAME."
echo "Process list saved for reboot recovery."
