/**
 * media.service.ts — media ingest + adaptive playback.
 */
import { Readable } from "node:stream";
import type { MediaKind, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import * as storage from "../../lib/storage/storage.js";
import { env } from "../../config/env.js";
import { processVideo, ffmpegAvailable } from "../../lib/media/transcode.js";
import { srtToVtt, transcribeToVtt, transcriptionAvailable, transcriptionIsLocal, translateVttFrToEn } from "../../lib/ai/subtitles.js";
import { signMediaToken } from "../../lib/auth/jwt.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { computeProgress } from "../../domain/engine/progress.js";
import { isStaff } from "../../domain/auth/permissions.js";

export class MediaError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

// --- access control: a learner may only fetch media of an UNLOCKED block -----

type AccessPrincipal = { id: string; role: Role } | null | undefined;

/** Storage keys are `sources/<assetId>/…` or `renditions/<assetId>/…`. */
export function assetIdFromKey(key: string): string | null {
  const parts = key.replace(/^\/+/, "").split("/");
  return parts.length >= 2 ? parts[1]! : null;
}

/** The block index that references this media asset in the course content, or null. */
function blockIndexForAsset(content: CourseContentT, assetId: string): number | null {
  for (const b of content.blocks) {
    if (b.type === "ONBOARDING" && b.payload.triggerVideo.mediaId === assetId) return b.index;
    if ("microSessions" in b.payload) {
      for (const m of b.payload.microSessions) if (m.video.mediaId === assetId) return b.index;
    }
  }
  return null;
}

/**
 * Tolerant (no-Zod) scan for an asset reference in stored content. Used as a
 * fallback when `CourseContent.parse` fails on an older published version whose
 * shape predates the current schema — we must NOT hard-lock a learner's media
 * just because the stored document fails strict validation. Walks the same
 * touchpoints (trigger video + micro-session videos) defensively.
 */
export function rawReferencesAsset(content: unknown, assetId: string): boolean {
  const blocks = (content as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const p = (b as { payload?: any })?.payload ?? {};
    if (p?.triggerVideo?.mediaId === assetId) return true;
    if (Array.isArray(p?.microSessions)) {
      for (const m of p.microSessions) if (m?.video?.mediaId === assetId) return true;
    }
  }
  return false;
}

/**
 * Enforce that the caller may access this asset. Staff have full access; a learner
 * is allowed only if one of their enrolments references the asset in a block that
 * is NOT locked by their progress. This closes the hole where any authenticated
 * learner could fetch any media (incl. a not-yet-unlocked block) by id/key.
 *
 * NOTE: this guards media served BY THE API. When a public CDN is configured
 * (MEDIA_PUBLIC_BASE_URL), bytes are served by the CDN and this check no longer
 * applies — locked-block protection then relies on the unguessable UUID keys.
 */
export async function assertAssetAccessible(principal: AccessPrincipal, assetId: string): Promise<void> {
  if (!principal) throw new MediaError(401, "unauthorized", "Authentification requise");
  if (isStaff(principal.role)) return;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: principal.id },
    include: { courseVersion: true, completions: true },
  });
  for (const e of enrollments) {
    let content: CourseContentT | null = null;
    try { content = CourseContent.parse(e.courseVersion.content); } catch { content = null; }
    if (content) {
      const idx = blockIndexForAsset(content, assetId);
      if (idx == null) continue;
      const progress = computeProgress(
        content,
        e.completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct })),
        Boolean(e.momentAncrage),
      );
      if (progress.blocks.find((b) => b.index === idx)?.state !== "locked") return;
    } else if (rawReferencesAsset(e.courseVersion.content, assetId)) {
      // Stored content fails strict validation (schema drift on an older
      // published version). Block-state gating can't be computed safely, but the
      // learner is legitimately enrolled in a course that references this asset —
      // allow playback rather than hard-locking ALL media behind a parse error.
      return;
    }
  }
  throw new MediaError(403, "block_locked", "Ce contenu n'est pas encore débloqué.");
}

function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "text/vtt" || mime === "application/x-subrip") return "CAPTIONS";
  return "VIDEO";
}
function extFromMime(mime: string): string {
  return ({ "video/mp4": "mp4", "video/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "image/jpeg": "jpg", "image/png": "png", "text/vtt": "vtt" } as Record<string, string>)[mime] ?? "bin";
}
function extFromName(name?: string): string | null {
  const m = name?.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1]!.toLowerCase() : null;
}

export async function createFromUpload(params: { filename?: string; mime: string; data: Readable | Buffer; createdById?: string }) {
  const kind = kindFromMime(params.mime);
  const asset = await prisma.mediaAsset.create({
    data: { kind, mime: params.mime, originalFilename: params.filename ?? null, storageKey: "pending", status: "UPLOADED", createdById: params.createdById ?? null },
  });
  const ext = extFromName(params.filename) ?? extFromMime(params.mime);
  const key = `sources/${asset.id}/source.${ext}`;

  try {
    const { sizeBytes } = await storage.put(key, params.data);
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key, sizeBytes, status: "PROCESSING" } });

    let durationSec: number | undefined;
    let specs;
    if (kind === "VIDEO") {
      const r = await processVideo({ id: asset.id, mime: params.mime, storageKey: key, sizeBytes });
      specs = r.renditions; durationSec = r.durationSec;
    } else {
      specs = [{ label: "source", kind, mime: params.mime, storageKey: key, downloadable: true, available: true, sizeBytes }];
    }
    await prisma.mediaRendition.createMany({ data: specs.map((s) => ({ assetId: asset.id, ...s })) });
    return prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "READY", durationSec: durationSec ?? null }, include: { renditions: true } });
  } catch (e) {
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
}

/** Register an externally hosted asset (provider URL) without uploading bytes. */
export async function registerExternal(params: { url: string; mime: string; durationSec?: number; createdById?: string }) {
  const kind = kindFromMime(params.mime);
  return prisma.mediaAsset.create({
    data: {
      kind, mime: params.mime, storageKey: "external", status: "READY", durationSec: params.durationSec ?? null, createdById: params.createdById ?? null,
      renditions: { create: { label: "source", kind, mime: params.mime, url: params.url, downloadable: false, available: true } },
    },
    include: { renditions: true },
  });
}

/** Media library listing (authoring). Newest first, with available renditions.
 *  Paged + searchable (filename) + filterable by folder ("root" = unfiled). */
export async function listMedia(opts: { q?: string; folder?: string; page?: number; pageSize?: number } = {}) {
  const term = opts.q?.trim();
  const where = {
    ...(term ? { originalFilename: { contains: term, mode: "insensitive" as const } } : {}),
    ...(opts.folder ? { folderId: opts.folder === "root" ? null : opts.folder } : {}),
  };
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 500;
  const [total, assets] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { renditions: { select: { label: true, available: true } } },
    }),
  ]);
  const rows = assets.map((a) => ({
    id: a.id, kind: a.kind, filename: a.originalFilename, mime: a.mime,
    sizeBytes: a.sizeBytes, durationSec: a.durationSec, status: a.status, error: a.error, createdAt: a.createdAt,
    folderId: a.folderId,
    renditions: a.renditions.filter((r) => r.available).map((r) => r.label),
  }));
  return { rows, total };
}

// --- library folders (one folder ≈ one course) --------------------------------

function validFolderName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new MediaError(422, "invalid_name", "Nom de dossier invalide (1 à 80 caractères)");
  return name;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/** Folders sorted by name, with how many assets each contains. */
export async function listFolders() {
  const folders = await prisma.mediaFolder.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assets: true } } },
  });
  return folders.map((f) => ({ id: f.id, name: f.name, assetCount: f._count.assets, createdAt: f.createdAt }));
}

/** Case-insensitive duplicate check ("Parcours A" vs "parcours a" is confusing). */
async function assertNameFree(name: string, excludeId?: string) {
  const dup = await prisma.mediaFolder.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (dup) throw new MediaError(409, "duplicate_name", `Un dossier « ${dup.name} » existe déjà`);
}

export async function createFolder(rawName: string) {
  const name = validFolderName(rawName);
  await assertNameFree(name);
  try {
    const f = await prisma.mediaFolder.create({ data: { name } });
    return { id: f.id, name: f.name, assetCount: 0, createdAt: f.createdAt };
  } catch (e) {
    if (isUniqueViolation(e)) throw new MediaError(409, "duplicate_name", `Un dossier « ${name} » existe déjà`);
    throw e;
  }
}

export async function renameFolder(id: string, rawName: string) {
  const name = validFolderName(rawName);
  await assertNameFree(name, id);
  try {
    const f = await prisma.mediaFolder.update({ where: { id }, data: { name }, include: { _count: { select: { assets: true } } } });
    return { id: f.id, name: f.name, assetCount: f._count.assets, createdAt: f.createdAt };
  } catch (e) {
    if (isUniqueViolation(e)) throw new MediaError(409, "duplicate_name", `Un dossier « ${name} » existe déjà`);
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      throw new MediaError(404, "not_found", "Dossier introuvable");
    }
    throw e;
  }
}

/** Delete a folder — only when empty (move its media out first). */
export async function deleteFolder(id: string) {
  const f = await prisma.mediaFolder.findUnique({ where: { id }, include: { _count: { select: { assets: true } } } });
  if (!f) throw new MediaError(404, "not_found", "Dossier introuvable");
  if (f._count.assets > 0) {
    throw new MediaError(409, "not_empty", `Le dossier « ${f.name} » contient ${f._count.assets} média(s) — déplacez-les d'abord`);
  }
  await prisma.mediaFolder.delete({ where: { id } });
  return { id };
}

/** Rename an asset and/or move it to a folder (folderId null = library root). */
export async function updateAsset(id: string, patch: { filename?: string; folderId?: string | null }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw new MediaError(404, "not_found", "Média introuvable");
  const data: { originalFilename?: string; folderId?: string | null } = {};
  if (patch.filename !== undefined) {
    const filename = patch.filename.trim().replace(/\s+/g, " ");
    if (!filename || filename.length > 140) throw new MediaError(422, "invalid_name", "Nom de média invalide (1 à 140 caractères)");
    data.originalFilename = filename;
  }
  if (patch.folderId !== undefined) {
    if (patch.folderId !== null) {
      const folder = await prisma.mediaFolder.findUnique({ where: { id: patch.folderId } });
      if (!folder) throw new MediaError(404, "folder_not_found", "Dossier introuvable");
    }
    data.folderId = patch.folderId;
  }
  const a = await prisma.mediaAsset.update({
    where: { id }, data,
    include: { renditions: { select: { label: true, available: true } } },
  });
  return {
    id: a.id, kind: a.kind, filename: a.originalFilename, mime: a.mime,
    sizeBytes: a.sizeBytes, durationSec: a.durationSec, status: a.status, error: a.error, createdAt: a.createdAt,
    folderId: a.folderId,
    renditions: a.renditions.filter((r) => r.available).map((r) => r.label),
  };
}

export async function getAsset(id: string) {
  const a = await prisma.mediaAsset.findUnique({ where: { id }, include: { renditions: true } });
  if (!a) throw new MediaError(404, "not_found", "Média introuvable");
  return a;
}

// --- sous-titres (pistes CAPTIONS d'un média vidéo) --------------------------

const CAPTION_LABELS: Record<string, string> = { fr: "Français", en: "English" };

/** Attache (ou remplace) UNE piste de sous-titres à un média vidéo. Le fichier
 *  est stocké une fois pour toutes puis servi statiquement — l'import manuel
 *  d'un .vtt/.srt corrigé passe par ici, comme la génération. */
export async function attachCaptions(assetId: string, params: { language: string; content: string; format?: "vtt" | "srt"; label?: string }) {
  const asset = await getAsset(assetId);
  if (asset.kind !== "VIDEO") throw new MediaError(422, "not_a_video", "Les sous-titres s'attachent à un média vidéo");
  const language = params.language.toLowerCase();
  if (!/^[a-z]{2}$/.test(language)) throw new MediaError(422, "bad_language", "Code langue attendu sur 2 lettres (ex. fr, en)");
  const vtt = params.format === "srt" ? srtToVtt(params.content) : params.content.trim().startsWith("WEBVTT") ? params.content : srtToVtt(params.content);
  if (!vtt.includes("-->")) throw new MediaError(422, "bad_captions", "Le fichier ne contient aucune cue de sous-titre (VTT/SRT attendu)");

  const key = `media/${assetId}/captions-${language}.vtt`;
  const { sizeBytes } = await storage.put(key, Buffer.from(vtt, "utf8"));
  // Remplacement idempotent : une seule piste par langue. Le label est le
  // libellé humain montré dans le sélecteur du lecteur (« Français », « English »).
  await prisma.mediaRendition.deleteMany({ where: { assetId, kind: "CAPTIONS", language } });
  return prisma.mediaRendition.create({
    data: {
      assetId, label: params.label ?? CAPTION_LABELS[language] ?? language.toUpperCase(),
      kind: "CAPTIONS", mime: "text/vtt", storageKey: key, language,
      sizeBytes, downloadable: true, available: true,
    },
  });
}

export async function removeCaptions(assetId: string, language: string) {
  const rows = await prisma.mediaRendition.findMany({ where: { assetId, kind: "CAPTIONS", language: language.toLowerCase() } });
  if (!rows.length) throw new MediaError(404, "not_found", "Aucune piste de sous-titres dans cette langue");
  for (const r of rows) if (r.storageKey) await storage.remove(r.storageKey).catch(() => {});
  await prisma.mediaRendition.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
}

export type CaptionsResult = {
  fr: { label: string; language: string | null };
  en: { label: string; language: string | null } | null;
  enError: string | null;
};
type CaptionJob =
  | { state: "running"; startedAt: number }
  | { state: "done"; startedAt: number; result: CaptionsResult }
  | { state: "error"; startedAt: number; error: string };

// Registre en mémoire des générations en cours/terminées (API mono-processus).
// Sert à la fois de garde anti-doublon et de statut consultable par l'admin.
const captionJobs = new Map<string, CaptionJob>();

export function captionsStatus(assetId: string): CaptionJob | { state: "idle" } {
  return captionJobs.get(assetId) ?? { state: "idle" };
}

/** Cœur de la génération : lit l'audio, transcrit (FR), traduit (EN). */
async function runCaptionsGeneration(assetId: string, audio: { label: string; storageKey: string }, originalFilename: string | null): Promise<CaptionsResult> {
  const chunks: Buffer[] = [];
  for await (const c of storage.read(audio.storageKey)) chunks.push(c as Buffer);
  const media = Buffer.concat(chunks);

  const vttFr = await transcribeToVtt(media, audio.label === "audio" ? "audio.m4a" : (originalFilename ?? "source.mp4"), "fr");
  const fr = await attachCaptions(assetId, { language: "fr", content: vttFr });

  let en: Awaited<ReturnType<typeof attachCaptions>> | null = null;
  let enError: string | null = null;
  try {
    const vttEn = await translateVttFrToEn(vttFr);
    en = await attachCaptions(assetId, { language: "en", content: vttEn });
  } catch (e) {
    enError = e instanceof Error ? e.message : "Traduction échouée";
  }
  return { fr: { label: fr.label, language: fr.language }, en: en ? { label: en.label, language: en.language } : null, enError };
}

/** Génération « une fois pour toutes » : transcription Whisper (FR) puis
 *  traduction EN, stockées comme pistes du média. Sans fournisseur → 409
 *  explicite ; sans fournisseur de traduction → la piste FR est quand même
 *  produite et l'erreur EN est rapportée (l'import manuel reste possible).
 *  Avec OpenAI (secondes) la génération est synchrone ; avec le Whisper local
 *  (minutes sur un petit VPS) elle part en arrière-plan → { started: true },
 *  statut consultable via captionsStatus(). */
export async function generateCaptions(assetId: string): Promise<CaptionsResult | { started: true }> {
  const asset = await getAsset(assetId);
  if (asset.kind !== "VIDEO") throw new MediaError(422, "not_a_video", "La génération de sous-titres s'applique à un média vidéo");
  if (!transcriptionAvailable()) {
    throw new MediaError(409, "transcription_unavailable",
      "Transcription indisponible : configurez OPENAI_API_KEY (OpenAI Whisper) ou le Whisper local embarqué. L'import manuel de fichiers .vtt/.srt reste possible.");
  }
  if (captionJobs.get(assetId)?.state === "running") {
    throw new MediaError(409, "generation_in_progress", "Une génération est déjà en cours pour cette vidéo — laissez-la se terminer");
  }
  // Entrée audio : la rendition « audio » (64 kbps, légère) si le transcodage
  // l'a produite, sinon le fichier source.
  const audio = asset.renditions.find((r) => r.label === "audio" && r.available && r.storageKey)
    ?? asset.renditions.find((r) => r.label === "source" && r.storageKey);
  if (!audio?.storageKey) throw new MediaError(422, "no_local_media", "Aucun fichier local à transcrire (média externe ?) — importez un .vtt/.srt manuellement");
  const local = transcriptionIsLocal();
  const MAX = 24 * 1024 * 1024; // limite de l'API Whisper d'OpenAI (~25 Mo) — le local n'est pas concerné
  if (!local && (await storage.sizeOf(audio.storageKey)) > MAX) {
    throw new MediaError(422, "media_too_large", "Fichier trop volumineux pour la transcription (25 Mo max) — attendez la rendition audio du transcodage ou importez un .vtt");
  }
  const input = { label: audio.label, storageKey: audio.storageKey };

  if (!local) {
    captionJobs.set(assetId, { state: "running", startedAt: Date.now() });
    try {
      const result = await runCaptionsGeneration(assetId, input, asset.originalFilename);
      captionJobs.set(assetId, { state: "done", startedAt: Date.now(), result });
      return result;
    } catch (e) {
      captionJobs.set(assetId, { state: "error", startedAt: Date.now(), error: e instanceof Error ? e.message : "Génération échouée" });
      throw e;
    }
  }

  // Whisper local : plusieurs minutes par vidéo → arrière-plan, réponse immédiate.
  const startedAt = Date.now();
  captionJobs.set(assetId, { state: "running", startedAt });
  void runCaptionsGeneration(assetId, input, asset.originalFilename)
    .then((result) => captionJobs.set(assetId, { state: "done", startedAt, result }))
    .catch((e) => {
      console.warn(`[captions] ${assetId} — génération locale échouée : ${e instanceof Error ? e.message : e}`);
      captionJobs.set(assetId, { state: "error", startedAt, error: e instanceof Error ? e.message : "Génération échouée" });
    });
  return { started: true };
}

/** Adaptive manifest: available renditions lowest-bitrate first + a recommended
 *  lite variant for poor connections + caption tracks. */
export async function playbackManifest(id: string) {
  const asset = await getAsset(id);
  const available = asset.renditions.filter((r) => r.available);
  const playable = available
    .filter((r) => r.kind === "VIDEO" || r.kind === "AUDIO")
    .sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9));
  // URL resolution order: (1) externally-hosted (Mux/provider) → its own URL;
  // (2) a CDN is configured (MEDIA_PUBLIC_BASE_URL) → the public CDN URL for the
  //     object key (offloads disk/bandwidth from the VPS); (3) default → the
  //     authenticated streaming endpoint on the API. Default behaviour is
  //     unchanged unless MEDIA_PUBLIC_BASE_URL is set.
  const cdn = !!env.MEDIA_PUBLIC_BASE_URL;
  // Without a CDN, native <video> streams from the authenticated API endpoint —
  // but it can't send a Bearer header, so we embed a short-lived signed token.
  const mediaToken = cdn ? null : await signMediaToken(id);
  const labelOf = (rid: string) => asset.renditions.find((x) => x.id === rid)!.label;
  const toUrl = (r: { id: string; url: string | null; storageKey: string | null }) =>
    r.url ?? (cdn && r.storageKey ? storage.publicUrl(r.storageKey) : `/api/v1/media/${id}/download?label=${encodeURIComponent(labelOf(r.id))}&t=${mediaToken}`);
  const recommendedLite = playable.find((r) => r.downloadable) ?? playable[0];

  return {
    assetId: id,
    status: asset.status,
    durationSec: asset.durationSec,
    ffmpeg: ffmpegAvailable(),
    renditions: playable.map((r) => ({ label: r.label, kind: r.kind, bitrateKbps: r.bitrateKbps, height: r.height, downloadable: r.downloadable, url: toUrl(r) })),
    recommendedLite: recommendedLite ? recommendedLite.label : null,
    captions: available.filter((r) => r.kind === "CAPTIONS").map((r) => ({ label: r.label, language: r.language, url: toUrl(r) })),
  };
}

export async function resolveRendition(assetId: string, label: string) {
  const r = await prisma.mediaRendition.findFirst({ where: { assetId, label } });
  if (!r || !r.available) throw new MediaError(404, "no_rendition", "Rendition indisponible");
  return r;
}

/** Course versions (title + version) whose content still references this asset.
 *  Used to block deletion of media that a published/draft course depends on. */
export async function assetReferences(assetId: string): Promise<string[]> {
  const versions = await prisma.courseVersion.findMany({ select: { title: true, version: true, content: true } });
  const out = new Set<string>();
  for (const v of versions) if (rawReferencesAsset(v.content, assetId)) out.add(`${v.title} (v${v.version})`);
  return [...out];
}

/** Delete a media asset: its stored objects (source + renditions) + DB rows.
 *  Refuses if any course still references it — unlink it in the editor first. */
export async function deleteMedia(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, include: { renditions: true } });
  if (!asset) throw new MediaError(404, "not_found", "Média introuvable");
  const refs = await assetReferences(assetId);
  if (refs.length) {
    throw new MediaError(409, "in_use", `Vidéo utilisée par : ${refs.join(", ")}. Déliez-la d'abord dans l'éditeur de cours, puis réessayez.`);
  }
  // Remove stored objects (best-effort: a missing file shouldn't block the delete).
  const keys = new Set<string>();
  if (asset.storageKey && !["external", "pending"].includes(asset.storageKey)) keys.add(asset.storageKey);
  for (const r of asset.renditions) if (r.storageKey) keys.add(r.storageKey);
  for (const k of keys) await storage.remove(k).catch(() => {});
  await prisma.mediaAsset.delete({ where: { id: assetId } }); // cascades to renditions
  return { id: assetId, removedObjects: keys.size };
}
