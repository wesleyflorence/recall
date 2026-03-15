#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORK_DIR"

if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  . ".env.local"
  set +a
fi

HOME_DIR="${HOME:-/Users/$(whoami)}"
BACKUP_DIR="${HOME_DIR}/backups/recall"
LOG_DIR="${HOME_DIR}/Library/Logs/recall"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${BACKUP_DIR}/recall-${TIMESTAMP}.sql.gz"

LOG_FILE="${LOG_DIR}/recall-backup.log"

{
  echo "[INFO] Starting recall backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_PATH"
  else
    pg_dump \
      --host "${PGHOST:-localhost}" \
      --port "${PGPORT:-5432}" \
      --username "${PGUSER:-$(whoami)}" \
      --dbname "${PGDATABASE:-recall}" \
      --no-password \
      --format plain \
      --file - \
      | gzip > "$BACKUP_PATH"
  fi
  echo "[INFO] Backup completed: $BACKUP_PATH"
  echo "[INFO] Finished at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$LOG_FILE" 2>&1
