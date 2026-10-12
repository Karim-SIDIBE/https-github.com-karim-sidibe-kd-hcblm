#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Automated backup for the K-HCBLM / DECLICK DIGITAL stack.
# Dumps PostgreSQL + the media volume + the .env secrets, rotates old copies,
# and (optionally) pushes a copy off-site via rclone.
#
# Run it from cron on the VPS (see deploy/README.md §Sauvegardes), e.g. daily:
#   15 2 * * *  /home/<user>/kd-hcblm/deploy/backup.sh >> /var/log/kd-backup.log 2>&1
#
# Env overrides:
#   BACKUP_DIR                   (default: deploy/backups)
#   BACKUP_RETENTION_DAYS        (default: 14 — db dumps + .env, légers)
#   BACKUP_MEDIA_EVERY_DAYS      (default: 7 — archive du volume médias au plus
#                                 une fois par N jours ; 0 = à chaque exécution)
#   BACKUP_MEDIA_RETENTION_DAYS  (default: 21 — rétention des media-*.tgz)
#   BACKUP_RCLONE_REMOTE         (e.g. "r2:declick-backups" — off-site, optional)
#
# Dimensionnement (incident du 12/10/2026, disque plein → plateforme à terre) :
# le volume médias pèse plusieurs Go de vidéos incompressibles ; l'archiver en
# entier CHAQUE nuit avec 14 j de rétention occupait ~70 Go. Les vidéos changent
# rarement : une archive hebdomadaire conservée 3 semaines suffit (la base, qui
# bouge tous les jours et reste légère, garde sa cadence quotidienne), et un
# garde-fou d'espace libre SAUTE l'archive médias avec un avertissement plutôt
# que de remplir le disque.
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
PROJECT="kd-hcblm"   # compose project name (docker-compose.yml: name:) → volume prefix
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MEDIA_EVERY_DAYS="${BACKUP_MEDIA_EVERY_DAYS:-7}"
MEDIA_RETENTION_DAYS="${BACKUP_MEDIA_RETENTION_DAYS:-21}"
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

# 2) Media volume (videos / captions / uploads) — hebdomadaire + garde-fou.
#    Une archive récente (< MEDIA_EVERY_DAYS jours) suffit : les médias changent
#    rarement, et chaque archive est une copie COMPLÈTE de plusieurs Go.
MEDIA_SIZE="—"
RECENT_MEDIA=""
[ "$MEDIA_EVERY_DAYS" -gt 0 ] && RECENT_MEDIA=$(find "$BACKUP_DIR" -name 'media-*.tgz' -mtime -"$MEDIA_EVERY_DAYS" -print -quit 2>/dev/null)
if [ -n "$RECENT_MEDIA" ]; then
  log "Media: archive récente conservée ($(basename "$RECENT_MEDIA") < ${MEDIA_EVERY_DAYS} j) — pas de nouvelle archive"
  MEDIA_SIZE="récente"
else
  # Garde-fou : ne JAMAIS remplir le disque pour une sauvegarde de médias (la
  # plateforme à terre coûte plus cher qu'une archive sautée d'une nuit). Les
  # vidéos sont déjà compressées : l'archive pèse ~la taille du volume.
  VOL_MB=$(docker run --rm -v "${PROJECT}_media:/data:ro" alpine du -sm /data 2>/dev/null | cut -f1 || echo 0)
  FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')
  NEED_MB=$((VOL_MB + 2048))   # marge : 2 Go doivent rester libres après l'archive
  if [ "${VOL_MB:-0}" -gt 0 ] && [ "$FREE_MB" -lt "$NEED_MB" ]; then
    log "  WARNING: espace insuffisant pour l'archive médias (volume ${VOL_MB} Mo, libre ${FREE_MB} Mo, requis ${NEED_MB} Mo) — archive SAUTÉE"
    MEDIA_SIZE="sautée (disque)"
  else
    log "Archiving media volume → media-$STAMP.tgz"
    if docker run --rm \
          -v "${PROJECT}_media:/data:ro" \
          -v "$BACKUP_DIR:/backup" \
          alpine tar czf "/backup/media-$STAMP.tgz" -C /data . 2>/dev/null; then
      MEDIA_SIZE=$(du -h "$BACKUP_DIR/media-$STAMP.tgz" | cut -f1)
    else
      log "  (media volume empty or absent — skipped)"
    fi
  fi
fi

# 3) Secrets / config (.env: DB password + JWT keys). Needed for a full restore.
cp "$ENV_FILE" "$BACKUP_DIR/env-$STAMP.bak"
chmod 600 "$BACKUP_DIR/env-$STAMP.bak"

# 4) Rotation (local) — rétentions séparées : db/env légers (quotidiens),
#    médias lourds (hebdomadaires).
log "Pruning local backups (db/env > ${RETENTION_DAYS} j, media > ${MEDIA_RETENTION_DAYS} j)"
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'env-*.bak' \) \
  -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'media-*.tgz' -mtime +"$MEDIA_RETENTION_DAYS" -delete

# 5) Off-site copy (optional, recommended). Survives a full VPS loss.
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Copying off-site → $BACKUP_RCLONE_REMOTE"
    MAX_RET=$RETENTION_DAYS
    [ "$MEDIA_RETENTION_DAYS" -gt "$MAX_RET" ] && MAX_RET=$MEDIA_RETENTION_DAYS
    rclone copy "$BACKUP_DIR" "$BACKUP_RCLONE_REMOTE" \
      --include 'db-*.dump' --include 'media-*.tgz' --include 'env-*.bak' \
      --max-age "$((MAX_RET + 1))d" || log "  WARNING: rclone copy failed"
  else
    log "  WARNING: BACKUP_RCLONE_REMOTE set but rclone not installed — off-site skipped"
  fi
else
  log "  (no BACKUP_RCLONE_REMOTE set — local backup only; add off-site for safety)"
fi

log "Backup OK — db=$DB_SIZE media=$MEDIA_SIZE → $BACKUP_DIR"
