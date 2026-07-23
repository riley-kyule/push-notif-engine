#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 /path/to/epe-backup.tar.gz [postgresql://.../empty_restore_drill_db]" >&2
  exit 2
fi

archive_path="$1"
restore_database_url="${2:-}"
test -f "$archive_path"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM

tar -tzf "$archive_path" | grep -q '^database\.dump$'
tar -tzf "$archive_path" | grep -q '^manifest\.json$'
if tar -tzf "$archive_path" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Archive contains an unsafe path." >&2
  exit 1
fi

tar -xzf "$archive_path" -C "$work_dir"
node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!manifest.createdAt || !Number.isInteger(manifest.mediaFileCount)) {
  throw new Error("Backup manifest is malformed");
}
' "$work_dir/manifest.json"

pg_restore --list "$work_dir/database.dump" >/dev/null

expected_media="$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).mediaFileCount)' "$work_dir/manifest.json")"
actual_media="$(find "$work_dir/media" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [ "$actual_media" -ne "$expected_media" ]; then
  echo "Media count mismatch: manifest=$expected_media archive=$actual_media" >&2
  exit 1
fi

if [ -n "$restore_database_url" ]; then
  case "$restore_database_url" in
    */*restore_drill*|*dbname=*restore_drill*) ;;
    *)
      echo "Refusing restore: disposable database name must contain 'restore_drill'." >&2
      exit 1
      ;;
  esac

  existing_tables="$(psql "$restore_database_url" -Atqc "SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'")"
  if [ "$existing_tables" -ne 0 ]; then
    echo "Refusing restore: drill database is not empty." >&2
    exit 1
  fi

  pg_restore --exit-on-error --no-owner --no-privileges --dbname "$restore_database_url" "$work_dir/database.dump"
  restored_tables="$(psql "$restore_database_url" -Atqc "SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'")"
  if [ "$restored_tables" -eq 0 ]; then
    echo "Restore produced no public tables." >&2
    exit 1
  fi
  echo "Full restore drill passed with $restored_tables public table(s)."
else
  echo "Archive integrity passed. Supply an empty *_restore_drill database URL to test a full restore."
fi
