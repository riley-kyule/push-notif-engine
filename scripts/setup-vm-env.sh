#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

timestamp="$(date +%Y%m%d%H%M%S)"

backup_if_exists() {
  local file="$1"
  if [[ -f "$file" ]]; then
    cp "$file" "${file}.bak.${timestamp}"
  fi
}

urlencode() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
}

read_secret() {
  local prompt="$1"
  local value=""
  read -r -s -p "$prompt" value
  printf '\n'
  printf '%s' "$value"
}

read_line() {
  local prompt="$1"
  local default_value="${2:-}"
  local value=""
  if [[ -n "$default_value" ]]; then
    read -r -p "$prompt [$default_value]: " value
    printf '%s' "${value:-$default_value}"
  else
    read -r -p "$prompt: " value
    printf '%s' "$value"
  fi
}

echo "EPE VM environment setup"
echo

db_password="$(read_secret "PostgreSQL password for user 'epe': ")"
if [[ -z "$db_password" ]]; then
  echo "A PostgreSQL password is required."
  exit 1
fi

encoded_db_password="$(urlencode "$db_password")"

access_secret="$(read_secret "JWT access secret (leave blank to generate): ")"
if [[ -z "$access_secret" ]]; then
  access_secret="$(openssl rand -hex 32)"
fi

refresh_secret="$(read_secret "JWT refresh secret (leave blank to generate): ")"
if [[ -z "$refresh_secret" ]]; then
  refresh_secret="$(openssl rand -hex 32)"
fi

google_client_id="$(read_line "Google OAuth client ID (optional)" "")"
media_backend="$(read_line "Campaign media storage backend" "local")"
media_root="$(read_line "Campaign media storage root" "storage/campaign-media")"
media_s3_config=""

if [[ "$media_backend" == "s3" ]]; then
  media_bucket="$(read_line "Campaign media storage bucket" "epe-campaign-media")"
  media_region="$(read_line "Campaign media storage region" "us-east-1")"
  media_endpoint="$(read_line "Campaign media storage endpoint (optional)" "")"
  media_access_key_id="$(read_line "Campaign media storage access key id (optional)" "")"
  media_secret_access_key="$(read_line "Campaign media storage secret access key (optional)" "")"
  media_force_path_style="$(read_line "Campaign media storage force path style" "true")"

  media_s3_config=$(cat <<EOF2
CAMPAIGN_MEDIA_STORAGE_BUCKET=${media_bucket}
CAMPAIGN_MEDIA_STORAGE_REGION=${media_region}
CAMPAIGN_MEDIA_STORAGE_FORCE_PATH_STYLE=${media_force_path_style}
$( [[ -n "${media_endpoint}" ]] && printf 'CAMPAIGN_MEDIA_STORAGE_ENDPOINT=%s\n' "${media_endpoint}" )
$( [[ -n "${media_access_key_id}" ]] && printf 'CAMPAIGN_MEDIA_STORAGE_ACCESS_KEY_ID=%s\n' "${media_access_key_id}" )
$( [[ -n "${media_secret_access_key}" ]] && printf 'CAMPAIGN_MEDIA_STORAGE_SECRET_ACCESS_KEY=%s\n' "${media_secret_access_key}" )
EOF2
)
fi

backup_if_exists "services/api/.env"
backup_if_exists "services/worker/.env"
backup_if_exists "apps/dashboard/.env"

cat > services/api/.env <<EOF
DATABASE_URL=postgresql://epe:${encoded_db_password}@127.0.0.1:5432/exotic_push_engine
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=${access_secret}
JWT_REFRESH_SECRET=${refresh_secret}
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
PORT=3001
CORS_ORIGINS=http://127.0.0.1:3000
CAMPAIGN_MEDIA_STORAGE_BACKEND=${media_backend}
CAMPAIGN_MEDIA_STORAGE_ROOT=${media_root}
${media_s3_config}
EOF

cat > services/worker/.env <<EOF
DATABASE_URL=postgresql://epe:${encoded_db_password}@127.0.0.1:5432/exotic_push_engine
REDIS_URL=redis://127.0.0.1:6379
BROWSER_PUSH_ACK_BASE_URL=http://127.0.0.1:3001/api
EOF

cat > apps/dashboard/.env <<EOF
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
DASHBOARD_API_BASE_URL=http://127.0.0.1:3001/api
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=${google_client_id}
EOF

echo
echo "Environment files updated."
echo "Backups were created with suffix .bak.${timestamp} if previous files existed."
