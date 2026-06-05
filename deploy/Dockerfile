# KD-HCBLM API — production image (monorepo-aware).
# Build context = repo ROOT:  docker build -f deploy/Dockerfile -t kd-api .
FROM node:22-slim

WORKDIR /app
# OpenSSL + CA certs are required by Prisma's query engine. ffmpeg powers the
# adaptive rendition ladder (720p/480p/240p-lite/audio) so low-bandwidth learners
# get a light stream and good connections get HD. Without it, only the source
# rendition exists.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget ffmpeg \
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

ENV NODE_ENV=production
EXPOSE 4000

# Apply pending migrations, then start the server. @kd/shared is source-only TS,
# so the server runs through tsx (no separate build step / no dual-package hazard).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
