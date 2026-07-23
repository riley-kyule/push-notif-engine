#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

REPO_DIR="${EPE_REPO_DIR:-$(pwd)}"
STACK_DIR="${EPE_STACK_DIR:-/srv/exotic/stacks/push-engine}"
REQUEST_DIR="${EPE_DEPLOYMENT_REQUEST_DIR:-/srv/exotic/run/push-engine}"
DEPLOY_USER="${SUDO_USER:-riley}"
DEPLOY_UID="$(id -u "$DEPLOY_USER")"
DEPLOY_GID="$(id -g "$DEPLOY_USER")"

if [[ "$DEPLOY_UID" != "1000" ]]; then
  echo "Expected $DEPLOY_USER to use UID 1000 (matching the non-root Node container), got $DEPLOY_UID." >&2
  exit 1
fi

getent group docker >/dev/null
id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker
for deployment_path in "$REPO_DIR" "$STACK_DIR" "$REQUEST_DIR"; do
  if [[ ! "$deployment_path" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "Deployment paths must be absolute and contain only letters, numbers, dot, underscore, dash, and slash." >&2
    exit 1
  fi
done
test -d "$REPO_DIR/.git"
test -f "$STACK_DIR/compose.yaml"
test -f "$REPO_DIR/infrastructure/deployment/epe-docker-updater.service"
test -f "$REPO_DIR/infrastructure/deployment/compose.updates.yaml"

install -d -m 0750 -o "$DEPLOY_UID" -g "$DEPLOY_GID" "$REQUEST_DIR"

install -m 0640 -o "$DEPLOY_UID" -g "$DEPLOY_GID" \
  "$REPO_DIR/infrastructure/deployment/compose.updates.yaml" \
  "$STACK_DIR/compose.updates.yaml"

cat > /etc/systemd/system/epe-docker-updater.service <<EOF
[Unit]
Description=Exotic Push Engine Docker update agent
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
User=$DEPLOY_USER
Group=docker
WorkingDirectory=$REPO_DIR
Environment=EPE_REPO_DIR=$REPO_DIR
Environment=EPE_COMPOSE_FILES=$STACK_DIR/compose.yaml:$STACK_DIR/compose.updates.yaml
Environment=EPE_DEPLOYMENT_REQUEST_DIR=$REQUEST_DIR
Environment=PUSH_ENGINE_IMAGE=exotic-push-engine:production
Environment=EPE_DEPLOY_BRANCH=main
ExecStart=/usr/bin/node $REPO_DIR/scripts/docker-update-agent.mjs
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$REPO_DIR $STACK_DIR $REQUEST_DIR

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 /etc/systemd/system/epe-docker-updater.service

systemctl daemon-reload
systemctl enable --now epe-docker-updater.service
systemctl --no-pager --full status epe-docker-updater.service

echo "Docker updater installed. Source: $REPO_DIR"
echo "Compose override: $STACK_DIR/compose.updates.yaml"
