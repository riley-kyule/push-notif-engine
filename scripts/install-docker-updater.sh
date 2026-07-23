#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

REPO_DIR="/srv/exotic/stacks/push-engine"
REQUEST_DIR="/srv/exotic/run/push-engine"
DEPLOY_USER="${SUDO_USER:-riley}"
DEPLOY_UID="$(id -u "$DEPLOY_USER")"
DEPLOY_GID="$(id -g "$DEPLOY_USER")"

if [[ "$DEPLOY_UID" != "1000" ]]; then
  echo "Expected $DEPLOY_USER to use UID 1000 (matching the non-root Node container), got $DEPLOY_UID." >&2
  exit 1
fi

getent group docker >/dev/null
id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker
test -f "$REPO_DIR/compose.yaml"
test -f "$REPO_DIR/infrastructure/deployment/epe-docker-updater.service"
test -f "$REPO_DIR/infrastructure/deployment/compose.updates.yaml"

install -d -m 0750 -o "$DEPLOY_UID" -g "$DEPLOY_GID" "$REQUEST_DIR"

install -m 0640 -o "$DEPLOY_UID" -g "$DEPLOY_GID" \
  "$REPO_DIR/infrastructure/deployment/compose.updates.yaml" \
  "$REPO_DIR/compose.updates.yaml"

install -m 0644 \
  "$REPO_DIR/infrastructure/deployment/epe-docker-updater.service" \
  /etc/systemd/system/epe-docker-updater.service

systemctl daemon-reload
systemctl enable --now epe-docker-updater.service
systemctl --no-pager --full status epe-docker-updater.service

echo "Docker updater installed. Compose override: $REPO_DIR/compose.updates.yaml"
