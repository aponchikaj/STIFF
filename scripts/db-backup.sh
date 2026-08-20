#!/usr/bin/env bash
#
# Snapshot the public schema before structural work.
#
# The database is a hosted Supabase instance shared by local development and
# the live site, so every migration is a production change. Run this first.
#
#   ./scripts/db-backup.sh              # -> backups/backup-<timestamp>.sql
#   ./scripts/db-backup.sh pre-variants # -> backups/pre-variants-<timestamp>.sql
#
# Homebrew's pg_dump is v14 and refuses a v17 server, hence the explicit path.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/.env"
PG_DUMP="${PG_DUMP:-/Library/PostgreSQL/17/bin/pg_dump}"
LABEL="${1:-backup}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found — copy backend/.env.example and fill it in." >&2
  exit 1
fi

if [[ ! -x "$PG_DUMP" ]]; then
  echo "error: pg_dump not found at $PG_DUMP" >&2
  echo "       set PG_DUMP=/path/to/pg_dump (must be v17 or newer)" >&2
  exit 1
fi

# Read the connection settings without printing them.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for var in DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_NAME; do
  if [[ -z "${!var:-}" ]]; then
    echo "error: $var is not set in $ENV_FILE" >&2
    exit 1
  fi
done

mkdir -p "$REPO_ROOT/backups"
OUT="$REPO_ROOT/backups/${LABEL}-$(date +%Y%m%d-%H%M%S).sql"

PGPASSWORD="$DB_PASSWORD" "$PG_DUMP" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USERNAME" \
  --dbname="$DB_NAME" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$OUT"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Keep the last 20. These contain the users table, so they are gitignored and
# should not accumulate on a laptop indefinitely.
KEEP=20
COUNT=$(find "$REPO_ROOT/backups" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')
if (( COUNT > KEEP )); then
  find "$REPO_ROOT/backups" -maxdepth 1 -name '*.sql' -print0 \
    | xargs -0 ls -t \
    | tail -n +$((KEEP + 1)) \
    | while read -r old; do
        echo "pruning $(basename "$old")"
        rm -f "$old"
      done
fi
