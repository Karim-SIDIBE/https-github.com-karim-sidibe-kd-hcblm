#!/usr/bin/env bash
# Local Postgres 16 dev cluster helper for KD-HCBLM.
# Usage: bash scripts/dev-db.sh {start|stop|status|psql}
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-$HOME/pgdata}"
PGSOCK="${PGSOCK:-$HOME/pgsock}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-declick}"
PGDB="${PGDB:-kd_hcblm}"
RUNAS="${PGRUNAS:-}"   # set to a non-root user name when running as root

run() { if [ -n "$RUNAS" ]; then su "$RUNAS" -c "$1"; else bash -c "$1"; fi; }

case "${1:-}" in
  start)
    if [ ! -d "$PGDATA/base" ]; then
      mkdir -p "$PGDATA"; [ -n "$RUNAS" ] && chown -R "$RUNAS" "$PGDATA"
      run "$PGBIN/initdb -D $PGDATA -U $PGUSER --auth=trust -E UTF8"
    fi
    mkdir -p "$PGSOCK"; [ -n "$RUNAS" ] && chown "$RUNAS" "$PGSOCK"
    run "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k $PGSOCK -c listen_addresses=127.0.0.1' -l $PGDATA/server.log start"
    sleep 2
    run "$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U $PGUSER -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$PGDB'\" | grep -q 1 || $PGBIN/psql -h 127.0.0.1 -p $PGPORT -U $PGUSER -d postgres -c 'CREATE DATABASE $PGDB'"
    echo "Postgres up on 127.0.0.1:$PGPORT, db=$PGDB"
    ;;
  stop)   run "$PGBIN/pg_ctl -D $PGDATA stop" ;;
  status) run "$PGBIN/pg_ctl -D $PGDATA status" ;;
  psql)   run "$PGBIN/psql -h 127.0.0.1 -p $PGPORT -U $PGUSER -d $PGDB" ;;
  *) echo "Usage: $0 {start|stop|status|psql}"; exit 1 ;;
esac
