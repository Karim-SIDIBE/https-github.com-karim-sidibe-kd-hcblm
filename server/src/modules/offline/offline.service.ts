/**
 * offline.service.ts — offline-first support (Pilier 6.2, low-connectivity).
 *
 * 1. buildBundle: a self-contained, PAM-injected snapshot of a course version +
 *    a media manifest, with a content hash usable as an ETag (304 caching) so a
 *    client only re-downloads when the content actually changed.
 * 2. applySync: replays a batch of actions queued offline. Idempotent (per-op
 *    ledger) and ordered by the client timestamp, so gating dependencies resolve
 *    naturally (a block completed offline before the next one unlocks it on sync).
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import {
  EngineError, captureMomentAncrage, completeItem, designatePeer, getResume, reconcile,
  savePosition, submitDiagnosticQuiz, submitFinalQuiz, submitInterBlockQuiz, submitTriggerQuiz,
} from "../enrollments/enrollments.service.js";

export class OfflineError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

async function load(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId }, include: { courseVersion: { include: { course: true } } },
  });
  if (!enrollment) throw new OfflineError(404, "not_found", "Inscription introuvable");
  const content = CourseContent.parse(enrollment.courseVersion.content);
  return { enrollment, content };
}

export type MediaAsset = { key: string; url: string; type: "video" | "captions" };

/** Walk the content for downloadable media (videos + captions). */
export function mediaManifest(content: CourseContentT): MediaAsset[] {
  const out: MediaAsset[] = [];
  const add = (key: string, url?: string | null, type: MediaAsset["type"] = "video") => {
    if (url && url.trim()) out.push({ key, url: url.trim(), type });
  };
  const video = (path: string, v: { url?: string; subtitlesUrl?: string }) => {
    add(`${path}.video`, v.url, "video");
    add(`${path}.captions`, v.subtitlesUrl, "captions");
  };
  for (const b of content.blocks) {
    if (b.type === "ONBOARDING") video(`blocks[${b.index}].trigger`, b.payload.triggerVideo);
    if ("microSessions" in b.payload) b.payload.microSessions.forEach((m) => video(`blocks[${b.index}].${m.id}`, m.video));
  }
  return out;
}

/** Stable content hash for ETag-based caching. Includes the PAM so that capturing
 *  it (which changes the injected text) invalidates a previously cached bundle. */
function bundleVersion(versionId: string, updatedAt: Date, momentAncrage: string | null): string {
  return createHash("sha256")
    .update(`${versionId}:${updatedAt.toISOString()}:${momentAncrage ?? ""}`)
    .digest("hex").slice(0, 32);
}

export async function buildBundle(enrollmentId: string) {
  const { enrollment, content } = await load(enrollmentId);
  const version = enrollment.courseVersion;
  const etag = bundleVersion(version.id, version.updatedAt, enrollment.momentAncrage);
  const rendered = injectMomentAncrage(content, enrollment.momentAncrage);
  return {
    etag,
    bundle: {
      bundleVersion: etag,
      generatedAt: new Date().toISOString(),
      course: { slug: version.course.slug, title: version.title, level: version.level, version: version.version },
      enrollmentId,
      content: rendered,
      media: mediaManifest(content),
    },
  };
}

// --- offline sync -----------------------------------------------------------

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** Apply a single decoded action to the engine. */
async function applyOne(enrollmentId: string, type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "moment_ancrage": return captureMomentAncrage(enrollmentId, String(payload.text ?? ""));
    case "peer": return designatePeer(enrollmentId, String(payload.name ?? ""), String(payload.email ?? ""));
    case "position": return savePosition(enrollmentId, num(payload.blockIndex), String(payload.itemKey ?? ""));
    case "complete_item":
      return completeItem(enrollmentId, num(payload.blockIndex), payload.itemType as never, String(payload.itemKey ?? ""), payload.data);
    case "quiz_trigger":
      return submitTriggerQuiz(enrollmentId, (payload.answers ?? {}) as Record<string, string>, payload.profileKey as string | undefined);
    case "quiz_diagnostic": return submitDiagnosticQuiz(enrollmentId, (payload.answers ?? {}) as Record<string, string>);
    case "quiz_interblock": return submitInterBlockQuiz(enrollmentId, (payload.answers ?? {}) as Record<string, string>);
    case "quiz_final": return submitFinalQuiz(enrollmentId, (payload.answers ?? {}) as Record<string, string>);
    default: throw new OfflineError(400, "unknown_type", `Type d'action inconnu : ${type}`);
  }
}

export type SyncAction = { opId: string; type: string; clientTs: string; payload?: Record<string, unknown> };
export type SyncOpResult = { opId: string; status: "applied" | "deduped" | "failed"; error?: string; message?: string };

export async function applySync(enrollmentId: string, actions: SyncAction[]) {
  await load(enrollmentId); // validates existence
  // Apply in client-timestamp order so gating dependencies resolve.
  const ordered = [...actions].sort((a, b) => new Date(a.clientTs).getTime() - new Date(b.clientTs).getTime());

  const results: SyncOpResult[] = [];
  for (const a of ordered) {
    const existing = await prisma.syncOperation.findUnique({ where: { enrollmentId_opId: { enrollmentId, opId: a.opId } } });
    if (existing) { results.push({ opId: a.opId, status: "deduped" }); continue; }
    try {
      await applyOne(enrollmentId, a.type, a.payload ?? {});
      await prisma.syncOperation.create({ data: { enrollmentId, opId: a.opId, type: a.type, clientTs: new Date(a.clientTs) } });
      results.push({ opId: a.opId, status: "applied" });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Concurrent replay recorded it first → treat as deduped.
        results.push({ opId: a.opId, status: "deduped" });
      } else if (e instanceof EngineError || e instanceof OfflineError) {
        results.push({ opId: a.opId, status: "failed", error: (e as { code: string }).code, message: e.message });
      } else { throw e; }
    }
  }

  const state = await reconcile(enrollmentId);
  const resume = await getResume(enrollmentId);
  return {
    serverTime: new Date().toISOString(),
    results,
    progress: state.progress,
    badges: state.badges,
    resume: resume.resume,
  };
}
