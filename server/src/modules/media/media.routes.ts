import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { MediaError, assertAssetAccessible, assetIdFromKey, createFolder, createFromUpload, deleteFolder, deleteMedia, getAsset, listFolders, listMedia, playbackManifest, registerExternal, renameFolder, resolveRendition, updateAsset } from "./media.service.js";
import * as storage from "../../lib/storage/storage.js";
import { scanStreamHead, scanUpload, readAll } from "../../lib/av/scan.js";
import { env } from "../../config/env.js";
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

// MIME types that a browser would execute inline (stored-XSS vector if an author
// uploads a crafted SVG/HTML). We serve these as an opaque download instead of
// letting them render on the media origin. Video/audio/image stay inline.
const INLINE_UNSAFE = /^(image\/svg\+xml|text\/html|application\/xhtml\+xml|application\/xml|text\/xml)\b/i;

/** Stream a stored object with HTTP range support (video seeking + partial fetch). */
async function sendObject(req: FastifyRequest, reply: FastifyReply, storageKey: string, mime: string) {
  const size = await storage.sizeOf(storageKey);
  if (INLINE_UNSAFE.test(mime)) {
    reply.header("Content-Disposition", "attachment");
    mime = "application/octet-stream";
  }
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

  // --- library folders (create / rename / delete-when-empty) ---
  app.get("/media/folders", { preHandler: guard("media:manage") }, async () => ({ data: await listFolders() }));

  app.post("/media/folders", { preHandler: guard("media:manage") }, async (req, reply) => {
    const { name } = z.object({ name: z.string() }).parse(req.body);
    try { return reply.status(201).send({ data: await createFolder(name) }); } catch (err) { return handle(reply, err); }
  });

  app.patch("/media/folders/:id", { preHandler: guard("media:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { name } = z.object({ name: z.string() }).parse(req.body);
    try { return { data: await renameFolder(id, name) }; } catch (err) { return handle(reply, err); }
  });

  app.delete("/media/folders/:id", { preHandler: guard("media:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await deleteFolder(id) }; } catch (err) { return handle(reply, err); }
  });

  // Rename an asset and/or move it into a folder (folderId null = root).
  app.patch("/media/:id", { preHandler: guard("media:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ filename: z.string().optional(), folderId: z.string().nullable().optional() })
      .refine((b) => b.filename !== undefined || b.folderId !== undefined, { message: "Aucun champ à modifier" })
      .parse(req.body);
    try { return { data: await updateAsset(id, body) }; } catch (err) { return handle(reply, err); }
  });

  // Upload a media file (multipart). Authors only.
  app.post("/media", { preHandler: guard("media:manage") }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.badRequest("Fichier manquant (champ multipart)");
    const opts = { filename: file.filename, mime: file.mimetype };
    try {
      // 1) Cheap, memory-safe head heuristic (EICAR + executable magic) for early reject.
      const { result, body } = await scanStreamHead(file.file, opts);
      if (!result.ok) return reply.status(422).send({ error: "infected", message: `Fichier refusé (antivirus) : ${result.reason}` });
      // 2) When a real engine is configured, scan the FULL object via ClamAV — the
      //    head heuristic alone misses payloads past the first 256 KB. Buffer the
      //    remaining stream (bounded by MEDIA_MAX_BYTES) and hand the buffer on.
      let data: typeof body = body;
      if (env.CLAMAV_HOST) {
        const buf = Buffer.isBuffer(body) ? body : await readAll(body);
        if (file.file.truncated) return reply.status(413).send({ error: "too_large", message: "Fichier trop volumineux" });
        const full = await scanUpload(buf, opts);
        if (!full.ok) return reply.status(422).send({ error: "infected", message: `Fichier refusé (antivirus) : ${full.reason}` });
        data = buf;
      }
      const asset = await createFromUpload({ filename: file.filename, mime: file.mimetype, data, createdById: req.principal?.id });
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

  // Delete a media asset (authors/admins). Blocked while a course references it.
  app.delete("/media/:id", { preHandler: guard("media:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return reply.send({ data: await deleteMedia(id) }); } catch (err) { return handle(reply, err); }
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
