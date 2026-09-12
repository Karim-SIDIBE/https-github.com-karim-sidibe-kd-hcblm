/**
 * f2f.service.ts — KOMPETENCES FACE2FACE (modèle K-SPEM v2.0), palier 1.
 *
 * Modules présentiels HORS e-learning : cohortes, sessions et émargement,
 * fiche d'ancrage (figée dès la Session 1 tenue), Journal de Bord structuré,
 * Missions Terrain, et certification par démonstration sur la grille du
 * SOCLE COMMUN d'évaluation — verrouillée tant que toutes les conditions
 * K-SPEM §6 ne sont pas réunies. La décision CERTIFIED émet un Open Badge
 * FACE2FACE (OB 2.0 hébergé + VC-JWT) et le certificat PDF.
 */
import { randomBytes, createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { RubricSchema, type Rubric } from "../../domain/content-model.js";
import { decideCertification } from "../../domain/engine/certification.js";
import { certificationPrereqs, f2fShape, F2F_JOURNAL_MIN_WORDS } from "../../domain/engine/f2f.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { hostedAssertion, verifiableCredential, credentialUrl, type AchievementInput } from "../../lib/credentials/openbadge.js";
import { signVcJwt } from "../credentials/credentials.service.js";
import { certificatePdf } from "../../lib/credentials/pdf.js";
import type { Principal } from "../../lib/auth.js";

export class F2fError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const isAdmin = (p: Principal) => hasPermission(p.role, "user:manage");
const isStaff = (p: Principal) => isAdmin(p) || hasPermission(p.role, "evaluation:assign") || hasPermission(p.role, "evaluation:grade");

// ---------------------------------------------------------------------------
// Modules & sessions
// ---------------------------------------------------------------------------

export async function createModule(input: {
  title: string; level: number; location?: string; trainerId?: string;
  rubric: unknown;
  sessions?: { index: number; title?: string; scheduledAt?: string; location?: string; durationMin?: number }[];
}) {
  const shape = f2fShape(input.level);
  // La grille est LE contrat du socle commun — même schéma que DECLICK.
  const rubric = RubricSchema.parse(input.rubric);
  if (input.trainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: input.trainerId } });
    if (!trainer) throw new F2fError(404, "trainer_not_found", "Formateur introuvable");
  }
  const byIndex = new Map((input.sessions ?? []).map((s) => [s.index, s]));
  return prisma.f2fModule.create({
    data: {
      title: input.title, level: input.level, location: input.location ?? null,
      trainerId: input.trainerId ?? null,
      rubric: rubric as unknown as Prisma.InputJsonValue,
      sessions: {
        create: Array.from({ length: shape.sessions }, (_, i) => {
          const idx = i + 1;
          const s = byIndex.get(idx);
          const isLast = idx === shape.sessions;
          return {
            index: idx,
            title: s?.title ?? (idx === 1 ? "Session 1 — Fondation" : isLast ? `Session ${idx} — Démonstration & certification` : `Session ${idx}`),
            scheduledAt: s?.scheduledAt ? new Date(s.scheduledAt) : null,
            location: s?.location ?? input.location ?? null,
            durationMin: s?.durationMin ?? 360,
          };
        }),
      },
    },
    include: { sessions: { orderBy: { index: "asc" } }, trainer: { select: { id: true, name: true, email: true } } },
  });
}

export async function listModules() {
  const modules = await prisma.f2fModule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      trainer: { select: { id: true, name: true } },
      sessions: { orderBy: { index: "asc" }, select: { index: true, title: true, scheduledAt: true, heldAt: true } },
      _count: { select: { participants: true } },
    },
  });
  return modules.map((m) => ({ ...m, shape: f2fShape(m.level) }));
}

async function loadModule(moduleId: string) {
  const module = await prisma.f2fModule.findUnique({
    where: { id: moduleId },
    include: { sessions: { orderBy: { index: "asc" }, include: { attendance: true } }, trainer: { select: { id: true, name: true, email: true } } },
  });
  if (!module) throw new F2fError(404, "module_not_found", "Module FACE2FACE introuvable");
  return module;
}

/** Le formateur du module, ou tout membre du staff d'évaluation/admin. */
function assertModuleStaff(module: { trainerId: string | null }, principal: Principal) {
  if (module.trainerId === principal.id || isStaff(principal)) return;
  throw new F2fError(403, "forbidden", "Réservé au formateur du module ou au staff");
}

export async function getModule(moduleId: string, principal: Principal) {
  const module = await loadModule(moduleId);
  assertModuleStaff(module, principal);
  const shape = f2fShape(module.level);
  const participants = await prisma.f2fParticipant.findMany({
    where: { moduleId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      anchor: { select: { id: true, updatedAt: true } },
      certification: { select: { decision: true, scoreTotal: true, evaluatedAt: true } },
      credential: { select: { id: true, issuedAt: true } },
      _count: { select: { journal: true, missions: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  const presentByParticipant = new Map<string, number[]>();
  for (const s of module.sessions) {
    for (const a of s.attendance) {
      if (!a.present) continue;
      presentByParticipant.set(a.participantId, [...(presentByParticipant.get(a.participantId) ?? []), s.index]);
    }
  }
  return {
    ...module,
    shape,
    participants: participants.map((p) => ({
      id: p.id, user: p.user, status: p.status, joinedAt: p.joinedAt,
      anchor: p.anchor ? { deposited: true, updatedAt: p.anchor.updatedAt } : { deposited: false },
      journalCount: p._count.journal, journalTarget: shape.journalMin,
      missionCount: p._count.missions,
      presentAt: (presentByParticipant.get(p.id) ?? []).sort((a, b) => a - b),
      certification: p.certification, credential: p.credential,
    })),
  };
}

export async function addParticipant(moduleId: string, input: { userId?: string; email?: string; name?: string }, principal: Principal) {
  const module = await loadModule(moduleId);
  assertModuleStaff(module, principal);
  let userId = input.userId ?? null;
  if (!userId) {
    if (!input.email) throw new F2fError(422, "user_required", "userId ou email requis");
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    userId = existing?.id
      ?? (await prisma.user.create({ data: { email, name: input.name?.trim() || email.split("@")[0]!, role: "LEARNER" } })).id;
  }
  try {
    return await prisma.f2fParticipant.create({
      data: { moduleId, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new F2fError(409, "already_participant", "Cette personne est déjà dans la cohorte");
    }
    throw e;
  }
}

/** Marque la session TENUE et enregistre l'émargement. Rejouable : l'appel
 *  met à jour l'émargement tant que nécessaire (correction d'erreur de saisie),
 *  `heldAt` conserve la date de première tenue. Tenir la Session 1 FIGE les
 *  fiches d'ancrage du module (règle produit). */
export async function holdSession(sessionId: string, attendance: { participantId: string; present: boolean; note?: string }[], principal: Principal) {
  const session = await prisma.f2fSession.findUnique({ where: { id: sessionId }, include: { module: true } });
  if (!session) throw new F2fError(404, "session_not_found", "Session introuvable");
  assertModuleStaff(session.module, principal);
  const participants = await prisma.f2fParticipant.findMany({ where: { moduleId: session.moduleId }, select: { id: true } });
  const known = new Set(participants.map((p) => p.id));
  for (const a of attendance) {
    if (!known.has(a.participantId)) throw new F2fError(422, "unknown_participant", `Participant ${a.participantId} hors de cette cohorte`);
  }
  await prisma.$transaction([
    prisma.f2fSession.update({ where: { id: sessionId }, data: { heldAt: session.heldAt ?? new Date() } }),
    ...attendance.map((a) => prisma.f2fAttendance.upsert({
      where: { sessionId_participantId: { sessionId, participantId: a.participantId } },
      update: { present: a.present, note: a.note ?? null },
      create: { sessionId, participantId: a.participantId, present: a.present, note: a.note ?? null },
    })),
  ]);
  return prisma.f2fSession.findUnique({ where: { id: sessionId }, include: { attendance: true } });
}

// ---------------------------------------------------------------------------
// Participant : fiche d'ancrage, journal, missions
// ---------------------------------------------------------------------------

async function loadParticipant(participantId: string) {
  const participant = await prisma.f2fParticipant.findUnique({
    where: { id: participantId },
    include: { module: { include: { sessions: { orderBy: { index: "asc" } } } }, user: { select: { id: true, name: true, email: true } } },
  });
  if (!participant) throw new F2fError(404, "participant_not_found", "Participant introuvable");
  return participant;
}

/** Lecture : le participant lui-même, le formateur du module, le staff. */
function assertReadAccess(participant: Awaited<ReturnType<typeof loadParticipant>>, principal: Principal) {
  if (participant.userId === principal.id) return;
  assertModuleStaff(participant.module, principal);
}

function assertSelf(participant: Awaited<ReturnType<typeof loadParticipant>>, principal: Principal) {
  if (participant.userId === principal.id || isAdmin(principal)) return;
  throw new F2fError(403, "forbidden", "Réservé au participant");
}

const session1Held = (participant: { module: { sessions: { index: number; heldAt: Date | null }[] } }) =>
  Boolean(participant.module.sessions.find((s) => s.index === 1)?.heldAt);

/** Fiche d'ancrage (Pilier 1) : modifiable par le participant tant que la
 *  Session 1 n'est pas tenue, puis DÉFINITIVEMENT figée. */
export async function upsertAnchor(
  participantId: string,
  input: { situation: string; behaviorChange: string; beneficiary: string },
  principal: Principal,
) {
  const participant = await loadParticipant(participantId);
  assertSelf(participant, principal);
  if (session1Held(participant)) {
    throw new F2fError(423, "anchor_frozen",
      "La fiche d'ancrage est définitivement figée depuis la fin de la Session 1 — elle sera revisitée en session finale.");
  }
  for (const [k, v] of Object.entries(input)) {
    if (!v?.trim()) throw new F2fError(422, "empty_field", `Champ « ${k} » vide — les 3 questions sont requises`);
  }
  return prisma.f2fAnchor.upsert({
    where: { participantId },
    update: { situation: input.situation.trim(), behaviorChange: input.behaviorChange.trim(), beneficiary: input.beneficiary.trim() },
    create: { participantId, situation: input.situation.trim(), behaviorChange: input.behaviorChange.trim(), beneficiary: input.beneficiary.trim() },
  });
}

export async function getAnchor(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  const anchor = await prisma.f2fAnchor.findUnique({ where: { participantId } });
  return anchor ? { ...anchor, frozen: session1Held(participant) } : null;
}

/** Entrée du Journal de Bord (Pilier 4) — FIGÉE à la soumission, comme toute
 *  production certifiante de la plateforme. */
export async function addJournalEntry(
  participantId: string,
  input: { periodIndex: number; entryDate: string; situation: string; action: string; observation: string; learning: string },
  principal: Principal,
) {
  const participant = await loadParticipant(participantId);
  assertSelf(participant, principal);
  const shape = f2fShape(participant.module.level);
  if (!Number.isInteger(input.periodIndex) || input.periodIndex < 1 || input.periodIndex > shape.periods) {
    throw new F2fError(422, "bad_period", `Période invalide (1..${shape.periods} pour le niveau ${participant.module.level})`);
  }
  const entryDate = new Date(input.entryDate);
  if (Number.isNaN(entryDate.getTime())) throw new F2fError(422, "bad_date", "Date d'entrée invalide");
  const totalWords = wordsOf(input.situation) + wordsOf(input.action) + wordsOf(input.observation) + wordsOf(input.learning);
  if (totalWords < F2F_JOURNAL_MIN_WORDS) {
    throw new F2fError(422, "too_short",
      `Entrée trop courte (${totalWords} mots) — décrivez la situation, votre action délibérée, l'observation et l'apprentissage (${F2F_JOURNAL_MIN_WORDS} mots minimum au total)`);
  }
  return prisma.f2fJournalEntry.create({
    data: {
      participantId, periodIndex: input.periodIndex, entryDate,
      situation: input.situation.trim(), action: input.action.trim(),
      observation: input.observation.trim(), learning: input.learning.trim(),
    },
  });
}

export async function listJournal(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  return prisma.f2fJournalEntry.findMany({ where: { participantId }, orderBy: [{ periodIndex: "asc" }, { entryDate: "asc" }] });
}

/** Mission Terrain engagée en fin de session (une par session, sauf la
 *  dernière). Saisissable par le participant ou le staff (engagement oral
 *  consigné en séance). */
export async function addMission(
  participantId: string,
  input: { sessionIndex: number; text: string; peerName?: string },
  principal: Principal,
) {
  const participant = await loadParticipant(participantId);
  if (participant.userId !== principal.id) assertModuleStaff(participant.module, principal);
  const shape = f2fShape(participant.module.level);
  if (!Number.isInteger(input.sessionIndex) || input.sessionIndex < 1 || input.sessionIndex >= shape.sessions) {
    throw new F2fError(422, "bad_session", `Mission possible après les sessions 1..${shape.sessions - 1}`);
  }
  if (!input.text?.trim()) throw new F2fError(422, "empty_mission", "Texte de mission requis");
  return prisma.f2fMission.upsert({
    where: { participantId_sessionIndex: { participantId, sessionIndex: input.sessionIndex } },
    update: { text: input.text.trim(), peerName: input.peerName?.trim() || null },
    create: { participantId, sessionIndex: input.sessionIndex, text: input.text.trim(), peerName: input.peerName?.trim() || null },
  });
}

/** Vue « mon module » du participant (progression complète). */
export async function participantOverview(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  const shape = f2fShape(participant.module.level);
  const [anchor, journal, missions, attendance, certification, credential] = await Promise.all([
    prisma.f2fAnchor.findUnique({ where: { participantId } }),
    prisma.f2fJournalEntry.findMany({ where: { participantId }, orderBy: [{ periodIndex: "asc" }, { entryDate: "asc" }] }),
    prisma.f2fMission.findMany({ where: { participantId }, orderBy: { sessionIndex: "asc" } }),
    prisma.f2fAttendance.findMany({ where: { participantId }, include: { session: { select: { index: true } } } }),
    prisma.f2fCertification.findUnique({ where: { participantId } }),
    prisma.f2fCredential.findUnique({ where: { participantId }, select: { id: true, issuedAt: true } }),
  ]);
  const presentAt = attendance.filter((a) => a.present).map((a) => a.session.index).sort((a, b) => a - b);
  return {
    id: participant.id, status: participant.status, user: participant.user,
    module: {
      id: participant.module.id, title: participant.module.title, level: participant.module.level,
      location: participant.module.location, shape,
      sessions: participant.module.sessions.map((s) => ({
        index: s.index, title: s.title, scheduledAt: s.scheduledAt, heldAt: s.heldAt,
        present: presentAt.includes(s.index),
      })),
    },
    anchor: anchor ? { ...anchor, frozen: session1Held(participant) } : null,
    journal: { entries: journal, count: journal.length, target: shape.journalMin },
    missions,
    certification, credential,
  };
}

/** Modules du principal connecté (vue participant). */
export async function myModules(principal: Principal) {
  const rows = await prisma.f2fParticipant.findMany({
    where: { userId: principal.id },
    include: { module: { select: { id: true, title: true, level: true, location: true } } },
    orderBy: { joinedAt: "desc" },
  });
  return rows.map((r) => ({ participantId: r.id, status: r.status, module: { ...r.module, shape: f2fShape(r.module.level) } }));
}

// ---------------------------------------------------------------------------
// Certification (socle commun §6 + verrou K-SPEM)
// ---------------------------------------------------------------------------

async function prereqInput(participant: Awaited<ReturnType<typeof loadParticipant>>) {
  const [attendance, journalCount, missions, anchor] = await Promise.all([
    prisma.f2fAttendance.findMany({ where: { participantId: participant.id }, include: { session: { select: { index: true } } } }),
    prisma.f2fJournalEntry.count({ where: { participantId: participant.id } }),
    prisma.f2fMission.findMany({ where: { participantId: participant.id }, select: { sessionIndex: true } }),
    prisma.f2fAnchor.findUnique({ where: { participantId: participant.id }, select: { id: true } }),
  ]);
  return {
    level: participant.module.level,
    sessions: participant.module.sessions.map((s) => ({ index: s.index, held: Boolean(s.heldAt) })),
    presentAt: attendance.filter((a) => a.present).map((a) => a.session.index),
    journalCount,
    missionAt: missions.map((m) => m.sessionIndex),
    hasAnchor: Boolean(anchor),
  };
}

/** Panneau des conditions de certification (K-SPEM §6, toutes requises). */
export async function certificationState(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  const verdict = certificationPrereqs(await prereqInput(participant));
  const certification = await prisma.f2fCertification.findUnique({ where: { participantId } });
  return { ...verdict, alreadyCertified: Boolean(certification), decision: certification?.decision ?? null };
}

/**
 * Décision certifiante sur la mise en situation finale. Gardes :
 *  - évaluateur : permission `evaluation:grade` (formateur-évaluateur, senior,
 *    admin) — le socle exige un évaluateur, pas un simple gestionnaire ;
 *  - VERROU K-SPEM §6 : refus 423 tant qu'une condition manque, avec le
 *    détail — l'évaluateur voit précisément ce qui bloque, le participant
 *    aussi ;
 *  - décision du SOCLE COMMUN §6 (seuil + minimums non compensables) via
 *    decideCertification — même moteur que DECLICK ;
 *  - CERTIFIED → émission de l'Open Badge FACE2FACE + statut du participant.
 */
export async function certify(
  participantId: string,
  input: { criteria: { points: number; evidence?: string }[]; feedback?: string },
  principal: Principal,
) {
  if (!hasPermission(principal.role, "evaluation:grade")) {
    throw new F2fError(403, "forbidden", "La décision certifiante est réservée aux évaluateurs (socle §5/§9)");
  }
  const participant = await loadParticipant(participantId);
  const existing = await prisma.f2fCertification.findUnique({ where: { participantId } });
  if (existing) throw new F2fError(409, "already_certified", `Décision déjà prononcée (${existing.decision}) — fiche scellée`);

  const verdict = certificationPrereqs(await prereqInput(participant));
  if (!verdict.ok) {
    const missing = verdict.prereqs.filter((p) => !p.ok).map((p) => p.label).join(" · ");
    throw new F2fError(423, "prereqs_missing", `Certification verrouillée (K-SPEM §6) — conditions manquantes : ${missing}`);
  }

  const rubric = RubricSchema.parse(participant.module.rubric) as Rubric;
  if (input.criteria.length !== rubric.criteria.length) {
    throw new F2fError(422, "scores_misaligned", `${rubric.criteria.length} scores attendus (un par comportement de la grille)`);
  }
  const banded = rubric.criteria.some((c) => (c.bands ?? []).length > 0);
  const scores = input.criteria.map((s, i) => {
    const spec = rubric.criteria[i]!;
    if (!Number.isInteger(s.points) || s.points < 0 || s.points > spec.weightPoints) {
      throw new F2fError(422, "bad_score", `Score invalide pour « ${spec.label} » (attendu 0..${spec.weightPoints})`);
    }
    if (banded && !s.evidence?.trim()) {
      throw new F2fError(422, "evidence_required", `Preuve d'observation requise pour « ${spec.label} » (règle 3 du socle)`);
    }
    return { points: s.points };
  });
  const decision = decideCertification(rubric.criteria, scores, rubric.threshold);
  const breakdown = rubric.criteria.map((c, i) => ({
    label: c.label, weightPoints: c.weightPoints, points: input.criteria[i]!.points,
    evidence: input.criteria[i]!.evidence?.trim() || null,
  }));

  const certification = await prisma.f2fCertification.create({
    data: {
      participantId, scores: breakdown as unknown as Prisma.InputJsonValue,
      scoreTotal: decision.total, decision: decision.decision,
      feedback: input.feedback?.trim() || null, evaluatorId: principal.id,
    },
  });
  await prisma.f2fParticipant.update({
    where: { id: participantId },
    data: { status: decision.decision === "CERTIFIED" ? "CERTIFIED" : "NOT_CERTIFIED" },
  });

  let credential = null;
  if (decision.decision === "CERTIFIED") {
    credential = await issueF2fCredential(participant, decision.total, rubric.threshold);
  }
  return { certification, decision, credential: credential ? { id: credential.id } : null };
}

/** Open Badge FACE2FACE : OB 2.0 hébergé + VC-JWT, servis par les routes
 *  publiques de vérification (repli F2F du module credentials). */
async function issueF2fCredential(
  participant: Awaited<ReturnType<typeof loadParticipant>>,
  score: number, threshold: number,
) {
  const shape = f2fShape(participant.module.level);
  const salt = randomBytes(16).toString("hex");
  const recipientHash = sha256(participant.user.email.toLowerCase() + salt);
  const achievement: AchievementInput = {
    courseSlug: `f2f-${participant.module.id}`,
    type: `F2F_NIVEAU_${participant.module.level}`,
    name: `Certification Niveau ${participant.module.level} · ${shape.label} — ${participant.module.title}`,
    description: `Certification KOMPETENCES FACE2FACE (modèle K-SPEM) : ${participant.module.title}, niveau ${participant.module.level} — ${shape.sessions} sessions présentielles, ${shape.periods} périodes de pratique terrain, Journal de Bord (${shape.journalMin} entrées minimum) et mise en situation certifiante observée par un évaluateur.`,
    criteria: [
      `Présence aux ${shape.sessions} sessions complètes`,
      `Journal de Bord : ${shape.journalMin} entrées terrain minimum`,
      "Missions Terrain engagées entre les sessions",
      "Mise en situation certifiante réussie (grille du socle commun)",
    ],
    result: { score, max: 100, threshold, passed: true },
  };
  const issuedAt = new Date();
  const row = await prisma.f2fCredential.create({
    data: {
      participantId: participant.id, achievementType: achievement.type,
      recipientSalt: salt, recipientHash, assertion: {}, vcJwt: "tmp",
    },
  });
  const assertion = hostedAssertion({ credentialId: row.id, achievement, recipientHash, recipientSalt: salt, issuedAt, revoked: false });
  const vc = verifiableCredential({ credentialId: row.id, achievement, recipientHash, subjectName: participant.user.name, issuedAt });
  const vcJwt = await signVcJwt(vc, recipientHash, row.id);
  return prisma.f2fCredential.update({
    where: { id: row.id },
    data: { assertion: assertion as unknown as Prisma.InputJsonValue, vcJwt, issuedAt },
  });
}

/** Certificat PDF FACE2FACE. Gabarits dédiés (assets/certificates/face2face)
 *  quand ils sont en place ; sinon la mise en page dessinée de secours du
 *  générateur — l'émission ne bloque jamais sur un visuel. */
export async function participantCertificatePdf(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  const credential = await prisma.f2fCredential.findUnique({ where: { participantId } });
  if (!credential) throw new F2fError(404, "no_credential", "Aucune certification émise pour ce participant");
  const pdf = await certificatePdf({
    recipientName: participant.user.name,
    achievementName: `Certification Niveau ${participant.module.level} · ${f2fShape(participant.module.level).label}`,
    courseTitle: participant.module.title,
    domainLabel: "KOMPETENCES FACE2FACE",
    level: participant.module.level as 1 | 2 | 3,
    licenseId: credential.id,
    issuedOn: credential.issuedAt,
    verifyUrl: credentialUrl(credential.id),
    templateDir: "assets/certificates/face2face",
  });
  return { pdf, filename: `certificat-face2face-niveau-${participant.module.level}.pdf` };
}
