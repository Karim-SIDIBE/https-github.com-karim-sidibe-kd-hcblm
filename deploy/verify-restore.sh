#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Backup restore DRILL (Vague B). Proves a backup is actually restorable —
# NON-DESTRUCTIVE: restores the latest (or given) db dump into a THROWAWAY
# database, runs sanity checks, then drops it. The live 'kd_hcblm' DB is never
# touched. Run it regularly (e.g. weekly cron) so "we have backups" becomes
# "we have *restorable* backups".
#
#   deploy/verify-restore.sh [deploy/backups/db-YYYYMMDD-HHMMSS.dump]
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env")
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
TEST_DB="kd_hcblm_restore_test"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP="$(ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null | head -1 || true)"
fi
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "✗ No db dump found (looked in $BACKUP_DIR). Run deploy/backup.sh first."; exit 1; }

echo "→ Restore drill using: $(basename "$DUMP")"
cleanup() { "${COMPOSE[@]}" exec -T db psql -U declick -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "→ Creating throwaway database $TEST_DB"
"${COMPOSE[@]}" exec -T db psql -U declick -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null
"${COMPOSE[@]}" exec -T db psql -U declick -d postgres -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

echo "→ Restoring dump into $TEST_DB"
"${COMPOSE[@]}" exec -T db pg_restore -U declick -d "$TEST_DB" --no-owner < "$DUMP" 2>/tmp/restore_drill.err || {
  # pg_restore may emit non-fatal warnings; only fail if no tables landed.
  echo "  (pg_restore reported warnings — verifying table presence)"
}

echo "→ Sanity checks"
USERS=$("${COMPOSE[@]}" exec -T db psql -U declick -d "$TEST_DB" -tAc 'SELECT count(*) FROM "User";' 2>/dev/null || echo "ERR")
COURSES=$("${COMPOSE[@]}" exec -T db psql -U declick -d "$TEST_DB" -tAc 'SELECT count(*) FROM "Course";' 2>/dev/null || echo "ERR")
TABLES=$("${COMPOSE[@]}" exec -T db psql -U declick -d "$TEST_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "ERR")

echo "   tables=$TABLES  users=$USERS  courses=$COURSES"
if [ "$TABLES" = "ERR" ] || [ "${TABLES:-0}" -lt 10 ]; then
  echo "✗ Restore drill FAILED — the dump did not restore a usable schema."
  exit 1
fi
echo "✓ Restore drill PASSED — backup is restorable ($TABLES tables). Throwaway DB dropped."
