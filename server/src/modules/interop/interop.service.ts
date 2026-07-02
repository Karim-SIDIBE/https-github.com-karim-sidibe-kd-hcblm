/**
 * interop.service.ts — import + run SCORM / cmi5 packages.
 *
 * Import: unzip → locate + parse the manifest → extract files to storage →
 * register the package. Run: a per-learner registration tracks SCORM runtime
 * data (Initialize/SetValue/Commit persisted via /tracking) or cmi5 state
 * (content launched with cmi5 params, reporting xAPI to our inbound endpoint).
 */
import AdmZip from "adm-zip";
import { randomBytes } from "node:crypto";
import { Prisma, type ImportType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import * as storage from "../../lib/storage/storage.js";
import { parseScorm, parseCmi5 } from "../../lib/interop/manifest.js";

export class InteropError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const base = () => env.PUBLIC_BASE_URL.replace(/\/$/, "");

// --- import -----------------------------------------------------------------

// Zip-bomb guards: a small archive must not be allowed to expand without bound.
const ZIP_MAX_ENTRIES = 5_000;
const ZIP_MAX_ENTRY_BYTES = 100 * 1024 * 1024;   // 100 MB per file (uncompressed)
const ZIP_MAX_TOTAL_BYTES = 500 * 1024 * 1024;   // 500 MB total (uncompressed)

export async function importPackage(zipBuffer: Buffer, createdById?: string) {
  let zip: AdmZip;
  try { zip = new AdmZip(zipBuffer); } catch { throw new InteropError(422, "bad_zip", "Archive ZIP invalide"); }
  const entries = zip.getEntries();

  // Reject a decompression bomb before extracting anything to storage.
  if (entries.length > ZIP_MAX_ENTRIES) throw new InteropError(422, "too_many_entries", "Archive refusée : trop de fichiers");
  let totalBytes = 0;
  for (const e of entries) {
    if (e.isDirectory) continue;
    const size = e.header.size;
    if (size > ZIP_MAX_ENTRY_BYTES) throw new InteropError(422, "entry_too_large", `Archive refusée : un fichier dépasse la taille maximale (${e.entryName})`);
    totalBytes += size;
    if (totalBytes > ZIP_MAX_TOTAL_BYTES) throw new InteropError(422, "archive_too_large", "Archive refusée : taille décompressée totale excessive");
  }

  const find = (name: string) => entries.find((e) => e.entryName.toLowerCase().endsWith(name) && !e.isDirectory);
  const cmi5Entry = find("cmi5.xml");
  const scormEntry = find("imsmanifest.xml");
  if (!cmi5Entry && !scormEntry) throw new InteropError(422, "no_manifest", "Ni imsmanifest.xml ni cmi5.xml trouvé");

  const parsed = cmi5Entry ? parseCmi5(cmi5Entry.getData().toString("utf8")) : parseScorm(scormEntry!.getData().toString("utf8"));

  const pkg = await prisma.importedPackage.create({
    data: { type: parsed.type as ImportType, title: parsed.title, launchHref: parsed.launchHref, structure: parsed.structure as Prisma.InputJsonValue, storagePrefix: "pending", createdById: createdById ?? null },
  });
  const prefix = `imports/${pkg.id}`;
  for (const e of entries) {
    if (e.isDirectory) continue;
    await storage.put(`${prefix}/${e.entryName}`, e.getData());
  }
  return prisma.importedPackage.update({ where: { id: pkg.id }, data: { storagePrefix: prefix } });
}

export async function getPackage(id: string) {
  const p = await prisma.importedPackage.findUnique({ where: { id } });
  if (!p) throw new InteropError(404, "not_found", "Paquet introuvable");
  return p;
}

// --- launch -----------------------------------------------------------------

async function ensureRegistration(packageId: string, userId: string) {
  return prisma.scormRegistration.upsert({
    where: { packageId_userId: { packageId, userId } },
    update: {},
    create: { packageId, userId },
  });
}

export async function launch(packageId: string, userId: string, learnerName: string) {
  const pkg = await getPackage(packageId);
  const reg = await ensureRegistration(packageId, userId);
  const contentUrl = `${base()}/api/v1/content/imports/${pkg.id}/${pkg.launchHref}`;

  if (pkg.type === "CMI5") {
    const token = reg.authToken ?? randomBytes(24).toString("base64url");
    if (!reg.authToken) await prisma.scormRegistration.update({ where: { id: reg.id }, data: { authToken: token } });
    const actor = { objectType: "Agent", name: learnerName, account: { homePage: base(), name: userId } };
    const params = new URLSearchParams({
      endpoint: `${base()}/api/v1/xapi/`,
      fetch: `${base()}/api/v1/imports/${pkg.id}/cmi5-fetch?token=${token}`,
      registration: reg.id,
      activityId: pkg.id,
      actor: JSON.stringify(actor),
    });
    return { type: pkg.type, registrationId: reg.id, launchUrl: `${contentUrl}?${params.toString()}` };
  }

  // SCORM: provide the content URL + the RTE persistence config + initial cmi.
  return {
    type: pkg.type,
    registrationId: reg.id,
    contentUrl,
    runtime: {
      version: pkg.type,
      commitUrl: `${base()}/api/v1/imports/${pkg.id}/tracking`,
      cmi: (reg.cmi as object) ?? defaultCmi(pkg.type, reg.location, reg.suspendData),
    },
  };
}

function defaultCmi(type: ImportType, location: string | null, suspend: string | null) {
  return type === "SCORM12"
    ? { core: { lesson_status: "not attempted", lesson_location: location ?? "", score: {} }, suspend_data: suspend ?? "" }
    : { completion_status: "not attempted", success_status: "unknown", location: location ?? "", suspend_data: suspend ?? "", score: {} };
}

// --- SCORM tracking (RTE Commit) --------------------------------------------

export async function commitScorm(packageId: string, userId: string, cmi: Record<string, any>) {
  const pkg = await getPackage(packageId);
  await ensureRegistration(packageId, userId);
  const v12 = pkg.type === "SCORM12";

  const completion = v12 ? cmi?.core?.lesson_status : cmi?.completion_status;
  const success = v12 ? (cmi?.core?.lesson_status === "passed" || cmi?.core?.lesson_status === "failed" ? cmi.core.lesson_status : undefined) : cmi?.success_status;
  const scoreScaled = v12 ? (cmi?.core?.score?.raw != null ? Number(cmi.core.score.raw) / 100 : undefined) : (cmi?.score?.scaled != null ? Number(cmi.score.scaled) : undefined);
  const scoreRaw = v12 ? (cmi?.core?.score?.raw != null ? Number(cmi.core.score.raw) : undefined) : (cmi?.score?.raw != null ? Number(cmi.score.raw) : undefined);
  const location = v12 ? cmi?.core?.lesson_location : cmi?.location;
  const suspendData = cmi?.suspend_data;

  return prisma.scormRegistration.update({
    where: { packageId_userId: { packageId, userId } },
    data: {
      completion: completion ?? undefined, success: success ?? undefined,
      scoreScaled: scoreScaled ?? undefined, scoreRaw: scoreRaw ?? undefined,
      location: location ?? undefined, suspendData: suspendData ?? undefined,
      cmi: cmi as Prisma.InputJsonValue,
    },
  });
}

export async function getRegistration(packageId: string, userId: string) {
  return prisma.scormRegistration.findUnique({ where: { packageId_userId: { packageId, userId } } });
}

// --- cmi5 inbound xAPI ------------------------------------------------------

const COMPLETED = ["http://adlnet.gov/expapi/verbs/completed", "https://w3id.org/xapi/adl/verbs/satisfied"];
const PASSED = ["http://adlnet.gov/expapi/verbs/passed"];
const FAILED = ["http://adlnet.gov/expapi/verbs/failed"];

/** Resolve a registration from a cmi5 inbound auth token. */
export async function registrationByToken(token: string) {
  const reg = await prisma.scormRegistration.findFirst({ where: { authToken: token } });
  if (!reg) throw new InteropError(401, "bad_token", "Jeton cmi5 invalide");
  return reg;
}

export async function ingestStatement(token: string, statement: Record<string, any>) {
  const reg = await registrationByToken(token);
  const verb = statement?.verb?.id ?? "";
  await prisma.inboundStatement.create({ data: { packageId: reg.packageId, userId: reg.userId, verb, statement: statement as Prisma.InputJsonValue } });

  const data: Prisma.ScormRegistrationUpdateInput = {};
  if (COMPLETED.includes(verb)) data.completion = "completed";
  if (PASSED.includes(verb)) data.success = "passed";
  if (FAILED.includes(verb)) data.success = "failed";
  const scaled = statement?.result?.score?.scaled;
  if (typeof scaled === "number") data.scoreScaled = scaled;
  if (Object.keys(data).length) await prisma.scormRegistration.update({ where: { id: reg.id }, data });
  return { stored: true, verb };
}

/**
 * LRS query (§8.1) — read stored xAPI statements by learner, course, date range
 * and statement type (verb). Joins through the enrolment so analytics can pull
 * without manual export. Staff-gated at the route.
 */
export async function queryStatements(filters: {
  learnerId?: string; courseId?: string; verb?: string; since?: Date; until?: Date; limit?: number;
}) {
  const where: Prisma.XapiStatementWhereInput = {};
  if (filters.verb) where.verb = filters.verb;
  if (filters.since || filters.until) {
    where.storedAt = {};
    if (filters.since) where.storedAt.gte = filters.since;
    if (filters.until) where.storedAt.lte = filters.until;
  }
  if (filters.learnerId || filters.courseId) {
    where.enrollment = {
      ...(filters.learnerId ? { userId: filters.learnerId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
    };
  }
  const rows = await prisma.xapiStatement.findMany({
    where, orderBy: { storedAt: "desc" }, take: Math.min(filters.limit ?? 200, 1000),
    select: { id: true, verb: true, objectId: true, statement: true, storedAt: true, enrollmentId: true },
  });
  return { count: rows.length, statements: rows };
}
