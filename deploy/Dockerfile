# KD-HCBLM API — production image (monorepo-aware).
# Build context = repo ROOT:  docker build -f deploy/Dockerfile -t kd-api .
FROM node:22-slim

WORKDIR /app
# OpenSSL + CA certs are required by Prisma's query engine. ffmpeg powers the
# adaptive rendition ladder (720p/480p/240p-lite/audio) so low-bandwidth learners
# get a light stream and good connections get HD. Without it, only the source
# rendition exists.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget ffmpeg gosu \
 && rm -rf /var/lib/apt/lists/*

# 1) Install dependencies using the workspace manifests (better layer caching).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

# 2) Copy only the workspaces the API needs (the PWA is built/served separately).
COPY packages/shared ./packages/shared
COPY server ./server

# 3) Generate the Prisma client.
WORKDIR /app/server
RUN npx prisma generate

# 4) Run as the unprivileged "node" user (uid 1000, shipped in the base image).
#    Own the app + a media dir so the runtime can write; the entrypoint fixes the
#    mounted volume's ownership at boot then drops privileges via gosu.
RUN mkdir -p /app/server/.media && chown -R node:node /app/server
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

# The entrypoint applies pending migrations then starts the server as non-root.
# @kd/shared is source-only TS, so the server runs through tsx (no build step).
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
