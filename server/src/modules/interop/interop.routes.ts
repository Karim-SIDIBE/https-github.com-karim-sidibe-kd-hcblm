import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  InteropError, commitScorm, getPackage, getRegistration, importPackage, ingestStatement, launch, queryStatements, registrationByToken, statementExportRow,
} from "./interop.service.js";
import { toCsv } from "../analytics/analytics.service.js";
import * as storage from "../../lib/storage/storage.js";
import { scanUpload } from "../../lib/av/scan.js";
import { authenticate, guard } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { TenantScopeError, assertCourseAccess } from "../../lib/security/tenant-scope.js";
import { isArchiveName, listArchives, openArchive } from "../../lib/lrs/retention.js";

const MIME: Record<string, string> = {
  html: "text/html", htm: "text/html", js: "text/javascript", css: "text/css", json: "application/json",
  xml: "application/xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", mp4: "video/mp4", mp3: "audio/mpeg", vtt: "text/vtt", woff2: "font/woff2",
};
const mimeFor = (p: string) => MIME[p.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof InteropError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

async function streamFile(req: FastifyRequest, reply: FastifyReply, key: string, mime: string) {
  let size: number;
  try { size = await storage.sizeOf(key); } catch { return reply.notFound("Fichier introuvable"); }
  reply.header("Accept-Ranges", "bytes").header("Content-Type", mime);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || start >= size) return reply.code(416).header("Content-Range", `bytes */${size}`).send();
    end = Math.min(end, size - 1);
    reply.code(206).header("Content-Range", `bytes ${start}-${end}/${size}`).header("Content-Length", end - start + 1);
    return reply.send(storage.readRange(key, start, end));
  }
  reply.header("Content-Length", size);
  return reply.send(storage.read(key));
}

export async function interopRoutes(app: FastifyInstance) {
  // Import a SCORM/cmi5 package (authors).
  app.post("/imports", { preHandler: guard("media:manage") }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.badRequest("Fichier ZIP manquant");
    try {
      const buf = await file.toBuffer();
      const scan = await scanUpload(buf, { filename: file.filename, mime: file.mimetype });
      if (!scan.ok) return reply.status(422).send({ error: "infected", message: `Fichier refusé (antivirus) : ${scan.reason}` });
      return reply.status(201).send({ data: await importPackage(buf, req.principal?.id) });
    } catch (err) { return handle(reply, err); }
  });

  app.get("/imports/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await getPackage(id) }; } catch (err) { return handle(reply, err); }
  });

  // Launch for the current learner → descriptor (SCORM runtime config or cmi5 URL).
  app.post("/imports/:id/launch", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await launch(id, req.principal!.id, req.principal!.name) }; } catch (err) { return handle(reply, err); }
  });

  // SCORM RTE Commit — persist the cmi data model.
  app.post("/imports/:id/tracking", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { cmi } = z.object({ cmi: z.record(z.string(), z.unknown()) }).parse(req.body);
    try { return { data: await commitScorm(id, req.principal!.id, cmi) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/imports/:id/registration", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await getRegistration(id, req.principal!.id) }; } catch (err) { return handle(reply, err); }
  });

  // Serve extracted package files (the launched content lives here).
  app.get("/content/imports/:id/*", { preHandler: authenticate }, async (req, reply) => {
    const { id, "*": rest } = req.params as { id: string; "*": string };
    return streamFile(req, reply, `imports/${id}/${rest}`, mimeFor(rest));
  });

  // --- cmi5 endpoints (called by launched content; token-authenticated) ---
  app.get("/imports/:id/cmi5-fetch", async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.query);
    try { await registrationByToken(token); return reply.send({ "auth-token": token }); } catch (err) { return handle(reply, err); }
  });

  // Inbound xAPI LRS for imported cmi5/xAPI content.
  app.post("/xapi/statements", async (req, reply) => {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return reply.status(401).send({ error: "unauthenticated", message: "Bearer requis" });
    const body = req.body as unknown;
    const statements = Array.isArray(body) ? body : [body];
    try {
      const results = [];
      for (const s of statements) results.push(await ingestStatement(token, s as Record<string, any>));
      return reply.send(results);
    } catch (err) { return handle(reply, err); }
  });

  // xAPI retention archives (two-tier local LRS): list + download. Platform-ops
  // data (cross-organisation) → job:run (SUPER_ADMIN / COURSE_ADMIN only).
  // Filesystem work lives in lib/lrs/retention (service layer); on top of the
  // global limiter these routes carry an explicit tight per-route rate limit.
  const archiveLimit = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
  app.get("/lrs/archives", { preHandler: guard("job:run"), ...archiveLimit }, async () => {
    return { data: listArchives() };
  });

  app.get("/lrs/archives/:name", { preHandler: guard("job:run"), ...archiveLimit }, async (req, reply) => {
    const { name } = z.object({ name: z.string().refine(isArchiveName) }).parse(req.params);
    const stream = openArchive(name);
    if (!stream) return reply.status(404).send({ error: "not_found", message: "Archive introuvable" });
    reply.header("content-type", "application/gzip");
    reply.header("content-disposition", `attachment; filename="${name}"`);
    return reply.send(stream);
  });

  // LRS query (§8.1) — read stored statements by learner, course, date range
  // and statement type (verb). For KOMPETENCES DECLICK analytics infrastructure.
  app.get("/lrs/statements", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const q = z.object({
      learnerId: z.string().optional(),
      courseId: z.string().optional(),
      verb: z.string().optional(),
      since: z.string().datetime().optional(),
      until: z.string().datetime().optional(),
      limit: z.coerce.number().int().positive().max(1000).optional(),
      /// json (défaut) = API ; csv = analyse tableur ; ndjson = xAPI brut ré-importable.
      format: z.enum(["json", "csv", "ndjson"]).default("json"),
    }).parse(req.query ?? {});
    // Tenant isolation: a non-staff customer role must pin the query to one of its
    // own courses (the courseId filter then confines statements to that course).
    if (!isStaff(req.principal!.role)) {
      if (!q.courseId) return reply.status(403).send({ error: "forbidden", message: "courseId requis pour ce rôle" });
      try { await assertCourseAccess(req.principal!, q.courseId); }
      catch (err) {
        if (err instanceof TenantScopeError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
        throw err;
      }
    }
    const result = await queryStatements({
      learnerId: q.learnerId, courseId: q.courseId, verb: q.verb,
      since: q.since ? new Date(q.since) : undefined,
      until: q.until ? new Date(q.until) : undefined,
      limit: q.limit,
    });
    if (q.format === "csv") {
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="xapi-statements.csv"`);
      return reply.send(toCsv(result.statements.map(statementExportRow)));
    }
    if (q.format === "ndjson") {
      reply.header("content-type", "application/x-ndjson");
      reply.header("content-disposition", `attachment; filename="xapi-statements.ndjson"`);
      return reply.send(result.statements
        .map(({ enrollment: _e, ...row }) => JSON.stringify({ ...row, storedAt: row.storedAt.toISOString() }))
        .join("\n"));
    }
    return { data: result };
  });
}
