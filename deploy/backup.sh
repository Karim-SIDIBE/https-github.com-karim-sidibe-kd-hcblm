#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Automated backup for the KD-HCBLM / DECLICK DIGITAL stack.
# Dumps PostgreSQL + the media volume + the .env secrets, rotates old copies,
# and (optionally) pushes a copy off-site via rclone.
#
# Run it from cron on the VPS (see deploy/README.md §Sauvegardes), e.g. daily:
#   15 2 * * *  /home/<user>/kd-hcblm/deploy/backup.sh >> /var/log/kd-backup.log 2>&1
#
# Env overrides:
#   BACKUP_DIR             (default: deploy/backups)
#   BACKUP_RETENTION_DAYS  (default: 14)
#   BACKUP_RCLONE_REMOTE   (e.g. "r2:declick-backups" — off-site, optional)
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
PROJECT="kd-hcblm"   # compose project name (docker-compose.yml: name:) → volume prefix
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[ -f "$ENV_FILE" ] || fail "missing $ENV_FILE"

# 1) PostgreSQL — custom format (-Fc): compact + supports selective restore.
log "Dumping PostgreSQL → db-$STAMP.dump"
"${COMPOSE[@]}" exec -T db pg_dump -U declick -d kd_hcblm -Fc > "$BACKUP_DIR/db-$STAMP.dump" \
  || fail "pg_dump failed (is the db container up?)"
DB_SIZE=$(du -h "$BACKUP_DIR/db-$STAMP.dump" | cut -f1)

# 2) Media volume (videos / captions / uploads). Skipped cleanly if empty/absent.
log "Archiving media volume → media-$STAMP.tgz"
if docker run --rm \
      -v "${PROJECT}_media:/data:ro" \
      -v "$BACKUP_DIR:/backup" \
      alpine tar czf "/backup/media-$STAMP.tgz" -C /data . 2>/dev/null; then
  MEDIA_SIZE=$(du -h "$BACKUP_DIR/media-$STAMP.tgz" | cut -f1)
else
  log "  (media volume empty or absent — skipped)"
  MEDIA_SIZE="—"
fi

# 3) Secrets / config (.env: DB password + JWT keys). Needed for a full restore.
cp "$ENV_FILE" "$BACKUP_DIR/env-$STAMP.bak"
chmod 600 "$BACKUP_DIR/env-$STAMP.bak"

# 4) Rotation (local).
log "Pruning local backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'media-*.tgz' -o -name 'env-*.bak' \) \
  -mtime +"$RETENTION_DAYS" -delete

# 5) Off-site copy (optional, recommended). Survives a full VPS loss.
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Copying off-site → $BACKUP_RCLONE_REMOTE"
    rclone copy "$BACKUP_DIR" "$BACKUP_RCLONE_REMOTE" \
      --include 'db-*.dump' --include 'media-*.tgz' --include 'env-*.bak' \
      --max-age "$((RETENTION_DAYS + 1))d" || log "  WARNING: rclone copy failed"
  else
    log "  WARNING: BACKUP_RCLONE_REMOTE set but rclone not installed — off-site skipped"
  fi
else
  log "  (no BACKUP_RCLONE_REMOTE set — local backup only; add off-site for safety)"
fi

log "Backup OK — db=$DB_SIZE media=$MEDIA_SIZE → $BACKUP_DIR"
