# K-HCBLM API — production image (monorepo-aware).
# Build context = repo ROOT:  docker build -f deploy/Dockerfile -t kd-api .

# --- Stage 1: whisper.cpp — local, free speech-to-text for subtitle generation.
# Compiled once at image build (cached layer); the quantized small model gives
# decent French at ~190 MB / ~600 MB inference RAM on CPU. No OpenAI account
# needed — OPENAI_API_KEY, when set, still takes precedence (faster).
FROM node:22-slim AS whisper
RUN apt-get update \
 && apt-get install -y --no-install-recommends git cmake g++ make ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v1.7.4 https://github.com/ggerganov/whisper.cpp /tmp/whisper.cpp \
 && cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build \
      -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
 && cmake --build /tmp/whisper.cpp/build -j"$(nproc)" --target whisper-cli
RUN wget -q -O /tmp/ggml-small-q5_1.bin \
      https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin

# --- Stage 2: the API itself.
FROM node:22-slim

WORKDIR /app
# OpenSSL + CA certs are required by Prisma's query engine. ffmpeg powers the
# adaptive rendition ladder (720p/480p/240p-lite/audio) so low-bandwidth learners
# get a light stream and good connections get HD. Without it, only the source
# rendition exists.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget ffmpeg gosu \
 && rm -rf /var/lib/apt/lists/*

# Local subtitle transcription (whisper.cpp) — binary + model baked in, wired up
# via env so it works out of the box; unset these to disable, or set
# OPENAI_API_KEY to use the (faster) hosted Whisper API instead.
COPY --from=whisper /tmp/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /tmp/ggml-small-q5_1.bin /opt/whisper/ggml-small-q5_1.bin
ENV WHISPER_CPP_BIN=/usr/local/bin/whisper-cli \
    WHISPER_CPP_MODEL=/opt/whisper/ggml-small-q5_1.bin

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
