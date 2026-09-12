/**
 * f2f.routes.ts — HTTP du département KOMPETENCES FACE2FACE (K-SPEM v2.0).
 *
 * Présentiel pur, AUCUN module e-learning : cohortes, sessions + émargement,
 * fiche d'ancrage (figée dès la Session 1 tenue), Journal de Bord, Missions
 * Terrain, certification par démonstration (grille du socle commun) et
 * Open Badge. Les gardes fines (formateur du module, participant lui-même,
 * verrou §6) vivent dans le service ; les routes posent l'authentification
 * et les permissions globales.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  F2fError, addJournalEntry, addMission, addParticipant, cancelHold, certificationState, certify,
  createModule, f2fKpis, getAnchor, getModule, getSelfAssessments, holdSession,
  listJournal, listModules, myModules, participantCertificatePdf, participantOverview,
  upsertAnchor, upsertSelfAssessment,
} from "./f2f.service.js";
import { authenticate, guard } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { audit } from "../../lib/audit.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof F2fError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

const idParam = z.object({ id: z.string() });

const createModuleBody = z.object({
  title: z.string().min(1),
  level: z.number().int(),
  location: z.string().optional(),
  trainerId: z.string().optional(),
  rubric: z.unknown(),
  sessions: z.array(z.object({
    index: z.number().int().min(1),
    title: z.string().optional(),
    scheduledAt: z.string().optional(),
    location: z.string().optional(),
    durationMin: z.number().int().min(30).optional(),
  })).optional(),
});

const anchorBody = z.object({
  situation: z.string(),
  behaviorChange: z.string(),
  beneficiary: z.string(),
});

const journalBody = z.object({
  periodIndex: z.number().int(),
  entryIndex: z.number().int(),
  entryDate: z.string(),
  situation: z.string(),
  action: z.string(),
  observation: z.string(),
  learning: z.string(),
});

const missionBody = z.object({
  sessionIndex: z.number().int(),
  text: z.string(),
  peerName: z.string().optional(),
});

const certifyBody = z.object({
  criteria: z.array(z.object({ points: z.number(), evidence: z.string().optional() })).min(1),
  feedback: z.string().optional(),
});

export async function f2fRoutes(app: FastifyInstance) {
  // --- Modules & sessions (staff / formateur) ---

  app.post("/f2f/modules", { preHandler: guard("evaluation:assign") }, async (req, reply) => {
    const body = createModuleBody.parse(req.body ?? {});
    try {
      const module = await createModule(body);
      await audit({ actorId: req.principal?.id, action: "f2f.module.create", targetType: "f2fModule", targetId: module.id, ip: req.ip, meta: { title: module.title, level: module.level } });
      return reply.status(201).send({ data: module });
    } catch (err) { return handle(reply, err); }
  });

  app.get("/f2f/modules", { preHandler: authenticate }, async (req, reply) => {
    if (!isStaff(req.principal!.role)) return reply.status(403).send({ error: "forbidden", message: "Réservé au personnel" });
    return { data: await listModules() };
  });

  app.get("/f2f/modules/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getModule(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/f2f/modules/:id/participants", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({ userId: z.string().optional(), email: z.string().email().optional(), name: z.string().optional() }).parse(req.body ?? {});
    try {
      const participant = await addParticipant(id, body, req.principal!);
      await audit({ actorId: req.principal?.id, action: "f2f.participant.add", targetType: "f2fModule", targetId: id, ip: req.ip, meta: { participantId: participant.id } });
      return reply.status(201).send({ data: participant });
    } catch (err) { return handle(reply, err); }
  });

  // Marque la session TENUE + émargement (rejouable pour corriger une saisie).
  // Tenir la Session 1 fige les fiches d'ancrage du module (règle produit).
  app.post("/f2f/sessions/:id/hold", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { attendance } = z.object({
      attendance: z.array(z.object({ participantId: z.string(), present: z.boolean(), note: z.string().optional() })),
    }).parse(req.body ?? {});
    try {
      const session = await holdSession(id, attendance, req.principal!);
      await audit({ actorId: req.principal?.id, action: "f2f.session.hold", targetType: "f2fSession", targetId: id, ip: req.ip, meta: { attendance: attendance.length } });
      return { data: session };
    } catch (err) { return handle(reply, err); }
  });

  // Annule une tenue saisie par erreur — Super Admin, dans les 24 h.
  app.delete("/f2f/sessions/:id/hold", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try {
      const session = await cancelHold(id, req.principal!);
      await audit({ actorId: req.principal?.id, action: "f2f.session.cancel_hold", targetType: "f2fSession", targetId: id, ip: req.ip });
      return { data: session };
    } catch (err) { return handle(reply, err); }
  });

  // --- Participant : mes modules, vue d'ensemble, ancrage, journal, missions ---

  app.get("/f2f/me/modules", { preHandler: authenticate }, async (req) => {
    return { data: await myModules(req.principal!) };
  });

  app.get("/f2f/participants/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await participantOverview(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.put("/f2f/participants/:id/anchor", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = anchorBody.parse(req.body ?? {});
    try { return { data: await upsertAnchor(id, body, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/f2f/participants/:id/anchor", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getAnchor(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/f2f/participants/:id/journal", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = journalBody.parse(req.body ?? {});
    try { return reply.status(201).send({ data: await addJournalEntry(id, body, req.principal!) }); } catch (err) { return handle(reply, err); }
  });

  app.get("/f2f/participants/:id/journal", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listJournal(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/f2f/participants/:id/missions", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = missionBody.parse(req.body ?? {});
    try { return reply.status(201).send({ data: await addMission(id, body, req.principal!) }); } catch (err) { return handle(reply, err); }
  });

  // --- Auto-évaluation K-SPEM (palier 2) ---

  app.put("/f2f/participants/:id/self-assessment", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      phase: z.enum(["ENTRY", "EXIT"]),
      score: z.number().int(),
      comment: z.string().optional(),
    }).parse(req.body ?? {});
    try { return { data: await upsertSelfAssessment(id, body, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/f2f/participants/:id/self-assessment", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getSelfAssessments(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  // --- Indicateurs K-SPEM (palier 2, staff) ---

  app.get("/f2f/kpis", { preHandler: authenticate }, async (req, reply) => {
    try { return { data: await f2fKpis(req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  // --- Certification (verrou K-SPEM §6 + socle commun) ---

  app.get("/f2f/participants/:id/certification-state", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await certificationState(id, req.principal!) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/f2f/participants/:id/certify", { preHandler: guard("evaluation:grade") }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = certifyBody.parse(req.body ?? {});
    try {
      const result = await certify(id, body, req.principal!);
      await audit({
        actorId: req.principal?.id, action: "f2f.certify", targetType: "f2fParticipant", targetId: id, ip: req.ip,
        meta: { decision: result.decision.decision, scoreTotal: result.decision.total, credentialId: result.credential?.id ?? null },
      });
      return reply.status(201).send({ data: result });
    } catch (err) { return handle(reply, err); }
  });

  app.get("/f2f/participants/:id/certificate.pdf", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try {
      const { pdf, filename } = await participantCertificatePdf(id, req.principal!);
      return reply.header("content-type", "application/pdf")
        .header("content-disposition", `inline; filename="${filename}"`).send(pdf);
    } catch (err) { return handle(reply, err); }
  });
}
