#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Restore the KD-HCBLM / DECLICK DIGITAL database (and optionally media) from a
# backup produced by deploy/backup.sh. DESTRUCTIVE: overwrites current data.
#
#   deploy/restore.sh deploy/backups/db-YYYYMMDD-HHMMSS.dump \
#                     [deploy/backups/media-YYYYMMDD-HHMMSS.tgz]
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env")
PROJECT="kd-hcblm"

DUMP="${1:-}"
MEDIA="${2:-}"
[ -n "$DUMP" ] || { echo "Usage: $0 <db-*.dump> [media-*.tgz]"; exit 1; }
[ -f "$DUMP" ] || { echo "Dump not found: $DUMP"; exit 1; }

echo "⚠  This OVERWRITES the live database 'kd_hcblm'"
[ -n "$MEDIA" ] && echo "⚠  …and REPLACES the media volume from $(basename "$MEDIA")"
echo "    Press Ctrl-C within 8s to abort."; sleep 8

echo "→ Restoring database from $DUMP"
"${COMPOSE[@]}" exec -T db pg_restore -U declick -d kd_hcblm --clean --if-exists --no-owner < "$DUMP"

if [ -n "$MEDIA" ]; then
  [ -f "$MEDIA" ] || { echo "Media archive not found: $MEDIA"; exit 1; }
  echo "→ Restoring media from $MEDIA"
  docker run --rm \
    -v "${PROJECT}_media:/data" \
    -v "$(cd "$(dirname "$MEDIA")" && pwd):/backup:ro" \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$MEDIA") -C /data"
fi

echo "→ Restarting API"
"${COMPOSE[@]}" restart api
echo "✓ Restore complete."
