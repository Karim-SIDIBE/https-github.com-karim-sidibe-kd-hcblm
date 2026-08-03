/**
 * lrs/retention.ts — two-tier xAPI retention (local-LRS optimisation).
 *
 * Not all statements have the same value over time: MILESTONES (completed,
 * passed, earned, registered, attended, initialized) are the proof of learning
 * and are kept forever; GRANULAR traces (answered per question, progressed on
 * videos, experienced) are precious hot, bulky cold. Granular statements older
 * than XAPI_RETENTION_MONTHS are appended to a compressed NDJSON archive
 * (standard xAPI JSON — re-importable into any LRS later) and then purged, so
 * the XapiStatement table stays bounded whatever the platform's growth.
 */
import { createReadStream, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import type { VerbKey } from "../../domain/engine/xapi.js";

/** Verbs eligible for archiving (XapiStatement.verb stores the short VerbKey,
 *  e.g. "answered" — the full IRI lives inside the statement JSON). Everything
 *  else is a milestone and is kept forever. */
export const GRANULAR_VERBS: readonly VerbKey[] = ["answered", "progressed", "experienced"];

export function isGranularVerb(verb: string): boolean {
  return (GRANULAR_VERBS as readonly string[]).includes(verb);
}

/** Cutoff date: `months` calendar months before `now`. */
export function retentionCutoff(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

export type ArchiveRow = {
  id: string;
  enrollmentId: string;
  verb: string;
  objectId: string;
  statement: unknown;
  storedAt: Date;
};

/** One NDJSON line per statement — envelope keeps the local ids for traceability. */
export function toNdjsonLine(row: ArchiveRow): string {
  return JSON.stringify({
    id: row.id,
    enrollmentId: row.enrollmentId,
    verb: row.verb,
    objectId: row.objectId,
    storedAt: row.storedAt.toISOString(),
    statement: row.statement,
  });
}

export type RetentionResult = {
  cutoff: string;
  archived: number;
  file: string | null;
  skipped?: boolean;
};

export function archiveDir(): string {
  return join(env.MEDIA_DIR, "xapi-archives");
}

/**
 * Archive-then-purge granular statements older than the retention window.
 * The archive file is fully written (and its size sanity-checked) BEFORE the
 * rows are deleted — a failed write leaves the data untouched for the next run.
 */
export async function archiveGranularStatements(now: Date = new Date(), batchSize = 5000): Promise<RetentionResult> {
  if (env.XAPI_RETENTION_MONTHS === 0) {
    return { cutoff: "", archived: 0, file: null, skipped: true };
  }
  const cutoff = retentionCutoff(now, env.XAPI_RETENTION_MONTHS);

  const lines: string[] = [];
  const ids: string[] = [];
  // Drain with a cursor so a large backlog doesn't balloon a single query.
  let cursor: string | undefined;
  for (;;) {
    const rows: ArchiveRow[] = await prisma.xapiStatement.findMany({
      where: { verb: { in: [...GRANULAR_VERBS] }, storedAt: { lt: cutoff } },
      orderBy: [{ storedAt: "asc" }, { id: "asc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, enrollmentId: true, verb: true, objectId: true, statement: true, storedAt: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      lines.push(toNdjsonLine(r));
      ids.push(r.id);
    }
    cursor = rows[rows.length - 1]!.id;
    if (rows.length < batchSize) break;
  }
  if (ids.length === 0) return { cutoff: cutoff.toISOString(), archived: 0, file: null };

  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const name = `xapi-granulaire-${stamp}.ndjson.gz`;
  const dir = archiveDir();
  mkdirSync(dir, { recursive: true });
  const payload = gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8"));
  const path = join(dir, name);
  writeFileSync(path, payload);
  // Belt-and-braces: only purge once the archive bytes are on disk.
  if (payload.length === 0) throw new Error("archive xAPI vide — purge annulée");

  // Delete in chunks (Postgres parameter limit safety).
  for (let i = 0; i < ids.length; i += batchSize) {
    await prisma.xapiStatement.deleteMany({ where: { id: { in: ids.slice(i, i + batchSize) } } });
  }

  return { cutoff: cutoff.toISOString(), archived: ids.length, file: name };
}

// --- archive access (used by the staff routes) -------------------------------

const ARCHIVE_NAME = /^xapi-granulaire-\d{14}\.ndjson\.gz$/;

export function isArchiveName(name: string): boolean {
  return ARCHIVE_NAME.test(name);
}

export type ArchiveInfo = { name: string; sizeBytes: number; createdAt: string };

/** Newest-first listing of retention archives (empty when none were written). */
export function listArchives(): ArchiveInfo[] {
  let names: string[] = [];
  try { names = readdirSync(archiveDir()).filter((n) => ARCHIVE_NAME.test(n)); } catch { /* dossier absent = aucune archive */ }
  return names.sort().reverse().map((name) => {
    const s = statSync(join(archiveDir(), name));
    return { name, sizeBytes: s.size, createdAt: s.mtime.toISOString() };
  });
}

/** Open a validated archive for download; null when absent or name invalid. */
export function openArchive(name: string): Readable | null {
  if (!ARCHIVE_NAME.test(name)) return null;
  const path = join(archiveDir(), name);
  try { statSync(path); } catch { return null; }
  return createReadStream(path);
}
