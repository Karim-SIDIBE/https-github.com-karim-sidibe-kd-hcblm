#!/bin/sh
# Container entrypoint — hardens the runtime by dropping to a non-root user.
#
# The container starts as root only long enough to (idempotently) fix ownership
# of the mounted media volume — which may be root-owned on pre-existing
# deployments — then drops all privileges via gosu and runs the API as the
# unprivileged "node" user. Combined with cap_drop/no-new-privileges in the
# compose file, a compromise of the Node process cannot escalate.
set -e

MEDIA_DIR="/app/server/.media"

# Only chown when needed (avoids a slow recursive pass on every boot).
if [ -d "$MEDIA_DIR" ] && [ "$(stat -c '%U' "$MEDIA_DIR" 2>/dev/null)" != "node" ]; then
  chown -R node:node "$MEDIA_DIR" 2>/dev/null || true
fi

# Apply pending DB migrations, then start the server — as the non-root user.
exec gosu node sh -c "npx prisma migrate deploy && npm run start:prod"
