import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { MediaError, assertAssetAccessible, assetIdFromKey, createFromUpload, getAsset, listMedia, playbackManifest, registerExternal, resolveRendition } from "./media.service.js";
import * as storage from "../../lib/storage/storage.js";
import { scanStreamHead } from "../../lib/av/scan.js";
import { authenticate, guard } from "../../lib/auth.js";
import { verifyMediaToken } from "../../lib/auth/jwt.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof MediaError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

/** Stream auth: a valid signed `?t=` media token for THIS asset, else fall back
 *  to Bearer auth (so the offline bundle / authenticated clients still work). */
async function mediaAuth(req: FastifyRequest, reply: FastifyReply) {
  const t = (req.query as { t?: string }).t;
  const id = (req.params as { id?: string }).id;
  if (t && id && (await verifyMediaToken(t).catch(() => null)) === id) {
    (req as unknown as { mediaTokenOk?: boolean }).mediaTokenOk = true;
    return;
  }
  // `authenticate` is an arrow handler (no `this` use); cast to a plain callable.
  return (authenticate as unknown as (rq: FastifyRequest, rp: FastifyReply, done: () => void) => Promise<void> | void)(req, reply, () => {});
}

/** Stream a stored object with HTTP range support (video seeking + partial fetch). */
async function sendObject(req: FastifyRequest, reply: FastifyReply, storageKey: string, mime: string) {
  const size = await storage.sizeOf(storageKey);
  reply.header("Accept-Ranges", "bytes").header("Content-Type", mime);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || start >= size) {
      return reply.code(416).header("Content-Range", `bytes */${size}`).send();
    }
    end = Math.min(end, size - 1);
    reply.code(206).header("Content-Range", `bytes ${start}-${end}/${size}`).header("Content-Length", end - start + 1);
    return reply.send(storage.readRange(storageKey, start, end));
  }
  reply.header("Content-Length", size);
  return reply.send(storage.read(storageKey));
}

export async function mediaRoutes(app: FastifyInstance) {
  // Media library (authoring) — authors/admins.
  app.get("/media", { preHandler: guard("media:manage") }, async () => ({ data: await listMedia() }));

  // Upload a media file (multipart). Authors only.
  app.post("/media", { preHandler: guard("media:manage") }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.badRequest("Fichier manquant (champ multipart)");
    try {
      const { result, body } = await scanStreamHead(file.file, { filename: file.filename, mime: file.mimetype });
      if (!result.ok) return reply.status(422).send({ error: "infected", message: `Fichier refusé (antivirus) : ${result.reason}` });
      const asset = await createFromUpload({ filename: file.filename, mime: file.mimetype, data: body, createdById: req.principal?.id });
      if (file.file.truncated) return reply.status(413).send({ error: "too_large", message: "Fichier trop volumineux" });
      return reply.status(201).send({ data: asset });
    } catch (err) { return handle(reply, err); }
  });

  // Register an externally-hosted asset (Mux/Cloudflare/CDN) without uploading.
  app.post("/media/external", { preHandler: guard("media:manage") }, async (req, reply) => {
    const body = z.object({ url: z.string().url(), mime: z.string().min(1), durationSec: z.number().int().positive().optional() }).parse(req.body);
    return reply.status(201).send({ data: await registerExternal({ ...body, createdById: req.principal?.id }) });
  });

  app.get("/media/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { await assertAssetAccessible(req.principal, id); return { data: await getAsset(id) }; } catch (err) { return handle(reply, err); }
  });

  // Adaptive playback manifest (lowest-bitrate first + recommended lite + captions).
  app.get("/media/:id/playback", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { await assertAssetAccessible(req.principal, id); return { data: await playbackManifest(id) }; } catch (err) { return handle(reply, err); }
  });

  // Download / stream a specific rendition (range-aware). For offline + playback.
  app.get("/media/:id/download", { preHandler: mediaAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { label } = z.object({ label: z.string().default("source") }).parse(req.query);
    try {
      if (!(req as unknown as { mediaTokenOk?: boolean }).mediaTokenOk) await assertAssetAccessible(req.principal, id);
      const r = await resolveRendition(id, label);
      if (r.url) return reply.redirect(r.url); // external/provider-hosted
      return sendObject(req, reply, r.storageKey!, r.mime);
    } catch (err) { return handle(reply, err); }
  });

  // Raw object by key (used by the offline bundle / publicUrl when no CDN).
  app.get("/media/file/:key", { preHandler: authenticate }, async (req, reply) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const decoded = decodeURIComponent(key);
    try {
      const assetId = assetIdFromKey(decoded);
      if (assetId) await assertAssetAccessible(req.principal, assetId);
      return await sendObject(req, reply, decoded, "application/octet-stream");
    } catch (err) {
      if (err instanceof MediaError) return handle(reply, err);
      return reply.notFound("Objet introuvable");
    }
  });
}
