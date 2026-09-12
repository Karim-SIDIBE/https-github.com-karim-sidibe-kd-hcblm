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
import {
  certificationPrereqs, convocationStage, entriesPerPeriod, f2fShape, journalNudgeDue, journalSlotOpensAt,
  F2F_HOLD_UNDO_MS, F2F_JOURNAL_MIN_WORDS, F2F_SELF_SCORE_MAX, F2F_SELF_SCORE_MIN,
} from "../../domain/engine/f2f.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { env } from "../../config/env.js";
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

/** Inscrit un participant. Compte inconnu : créé avec un mot de passe
 *  provisoire et INVITÉ par e-mail (lien du front FACE2FACE) — même mécanique
 *  que la console entreprise. Compte existant : notification d'inscription. */
export async function addParticipant(moduleId: string, input: { userId?: string; email?: string; name?: string }, principal: Principal) {
  const module = await loadModule(moduleId);
  assertModuleStaff(module, principal);
  let userId = input.userId ?? null;
  let invitation: { created: boolean; tempPassword?: string } | null = null;
  if (!userId) {
    if (!input.email) throw new F2fError(422, "user_required", "userId ou email requis");
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      userId = existing.id;
      invitation = { created: false };
    } else {
      const { generateTempPassword } = await import("../users/users.service.js");
      const { hashPassword } = await import("../../lib/auth/password.js");
      const tempPassword = generateTempPassword();
      const created = await prisma.user.create({
        data: {
          email, name: input.name?.trim() || email.split("@")[0]!, role: "LEARNER",
          passwordHash: await hashPassword(tempPassword), emailVerifiedAt: new Date(),
        },
      });
      userId = created.id;
      invitation = { created: true, tempPassword };
    }
  }
  try {
    const participant = await prisma.f2fParticipant.create({
      data: { moduleId, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (invitation) {
      const shape = f2fShape(module.level);
      const access = invitation.created && invitation.tempPassword
        ? `Identifiant : ${participant.user.email}\nMot de passe provisoire : ${invitation.tempPassword}\n(changez-le à votre première connexion)`
        : `Connectez-vous avec votre compte habituel (${participant.user.email}).`;
      await enqueueNotification({
        recipientKind: "LEARNER", recipient: participant.user.email, provider: "f2f-invite",
        subject: `Votre inscription — ${module.title} (KOMPETENCES FACE2FACE)`,
        body:
          `Bonjour ${participant.user.name},\n\n` +
          `Vous êtes inscrit·e au module présentiel « ${module.title} » ` +
          `(Niveau ${module.level} · ${shape.label} — ${shape.sessions} sessions).\n\n` +
          `Votre espace participant : ${env.F2F_APP_URL}\n${access}\n\n` +
          `Vous y trouverez votre parcours, votre fiche d'ancrage, votre Journal de Bord ` +
          `et vos missions terrain.\n\n` +
          `KOMPETENCES FACE2FACE — L'apprentissage par l'échange et l'immersion totale`,
      });
    }
    return { ...participant, invited: Boolean(invitation), accountCreated: invitation?.created ?? false };
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

/** Supprime un module (groupe) créé par erreur — réservé au SUPER ADMIN.
 *  Refusé dès qu'un Open Badge a été émis dans le groupe : les liens de
 *  vérification publics ne doivent jamais mourir. Sinon, tout le contenu du
 *  groupe part en cascade (sessions, émargements, ancrages, journaux,
 *  missions, auto-évaluations, décisions non certifiées). */
export async function deleteModule(moduleId: string, principal: Principal) {
  if (principal.role !== "SUPER_ADMIN") {
    throw new F2fError(403, "forbidden", "La suppression d'un groupe est réservée au Super Admin");
  }
  const module = await prisma.f2fModule.findUnique({
    where: { id: moduleId },
    include: { _count: { select: { participants: true } } },
  });
  if (!module) throw new F2fError(404, "module_not_found", "Module FACE2FACE introuvable");
  const credential = await prisma.f2fCredential.findFirst({ where: { participant: { moduleId } }, select: { id: true } });
  if (credential) {
    throw new F2fError(409, "credentials_issued",
      "Des Open Badges ont été émis dans ce groupe — il ne peut plus être supprimé (les liens de vérification doivent rester valides). Archivez-le plutôt.");
  }
  await prisma.f2fModule.delete({ where: { id: moduleId } });
  return { id: moduleId, title: module.title, participants: module._count.participants };
}

/** Annule une tenue de session saisie PAR ERREUR — réservé au SUPER ADMIN,
 *  dans les 24 h suivant la tenue. Efface l'émargement et rouvre ce que la
 *  tenue avait fermé (fiche d'ancrage si Session 1, créneaux du journal…).
 *  Refusé si une décision certifiante s'est appuyée sur cette tenue. */
export async function cancelHold(sessionId: string, principal: Principal) {
  if (principal.role !== "SUPER_ADMIN") {
    throw new F2fError(403, "forbidden", "L'annulation d'une tenue de session est réservée au Super Admin");
  }
  const session = await prisma.f2fSession.findUnique({ where: { id: sessionId }, include: { module: true } });
  if (!session) throw new F2fError(404, "session_not_found", "Session introuvable");
  if (!session.heldAt) throw new F2fError(409, "not_held", "Cette session n'est pas marquée tenue");
  if (Date.now() - session.heldAt.getTime() > F2F_HOLD_UNDO_MS) {
    throw new F2fError(423, "too_late", "La tenue date de plus de 24 h — elle ne peut plus être annulée");
  }
  const sealed = await prisma.f2fCertification.findFirst({
    where: { participant: { moduleId: session.moduleId }, evaluatedAt: { gte: session.heldAt } },
  });
  if (sealed) throw new F2fError(409, "sealed", "Une décision certifiante a été prononcée depuis cette tenue — annulation impossible");
  await prisma.$transaction([
    prisma.f2fAttendance.deleteMany({ where: { sessionId } }),
    prisma.f2fSession.update({ where: { id: sessionId }, data: { heldAt: null } }),
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

/** Entrée du Journal de Bord — FIGÉE à la soumission. Chaque période compte
 *  3 entrées à créneaux : l'entrée k s'ouvre à J+7·k après la session qui
 *  ouvre la période (rythme hebdomadaire, comme les déclencheurs DECLICK). */
export async function addJournalEntry(
  participantId: string,
  input: { periodIndex: number; entryIndex: number; entryDate: string; situation: string; action: string; observation: string; learning: string },
  principal: Principal,
) {
  const participant = await loadParticipant(participantId);
  assertSelf(participant, principal);
  const shape = f2fShape(participant.module.level);
  const perPeriod = entriesPerPeriod(participant.module.level);
  if (!Number.isInteger(input.periodIndex) || input.periodIndex < 1 || input.periodIndex > shape.periods) {
    throw new F2fError(422, "bad_period", `Période invalide (1..${shape.periods} pour le niveau ${participant.module.level})`);
  }
  if (!Number.isInteger(input.entryIndex) || input.entryIndex < 1 || input.entryIndex > perPeriod) {
    throw new F2fError(422, "bad_entry", `Entrée invalide (1..${perPeriod} par période)`);
  }
  const session = participant.module.sessions.find((s) => s.index === input.periodIndex);
  if (!session?.heldAt) {
    throw new F2fError(423, "period_locked", `La période ${input.periodIndex} s'ouvre après la Session ${input.periodIndex}.`);
  }
  const opensAt = journalSlotOpensAt(session.heldAt, input.entryIndex);
  if (opensAt.getTime() > Date.now()) {
    throw new F2fError(423, "entry_locked",
      `L'entrée ${input.entryIndex} de la période ${input.periodIndex} s'ouvre le ${opensAt.toLocaleDateString("fr-FR")} — une entrée par semaine, au rythme du terrain.`);
  }
  const entryDate = new Date(input.entryDate);
  if (Number.isNaN(entryDate.getTime())) throw new F2fError(422, "bad_date", "Date d'entrée invalide");
  const totalWords = wordsOf(input.situation) + wordsOf(input.action) + wordsOf(input.observation) + wordsOf(input.learning);
  if (totalWords < F2F_JOURNAL_MIN_WORDS) {
    throw new F2fError(422, "too_short",
      `Entrée trop courte (${totalWords} mots) — décrivez la situation, votre action délibérée, l'observation et l'apprentissage (${F2F_JOURNAL_MIN_WORDS} mots minimum au total)`);
  }
  try {
    return await prisma.f2fJournalEntry.create({
      data: {
        participantId, periodIndex: input.periodIndex, entryIndex: input.entryIndex, entryDate,
        situation: input.situation.trim(), action: input.action.trim(),
        observation: input.observation.trim(), learning: input.learning.trim(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new F2fError(409, "entry_done", "Cette entrée est déjà déposée — elle est figée.");
    }
    throw e;
  }
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
  const [anchor, journal, missions, attendance, certification, credential, selfAssessments] = await Promise.all([
    prisma.f2fAnchor.findUnique({ where: { participantId } }),
    prisma.f2fJournalEntry.findMany({ where: { participantId }, orderBy: [{ periodIndex: "asc" }, { entryDate: "asc" }] }),
    prisma.f2fMission.findMany({ where: { participantId }, orderBy: { sessionIndex: "asc" } }),
    prisma.f2fAttendance.findMany({ where: { participantId }, include: { session: { select: { index: true } } } }),
    prisma.f2fCertification.findUnique({ where: { participantId } }),
    prisma.f2fCredential.findUnique({ where: { participantId }, select: { id: true, issuedAt: true } }),
    prisma.f2fSelfAssessment.findMany({ where: { participantId } }),
  ]);
  const presentAt = attendance.filter((a) => a.present).map((a) => a.session.index).sort((a, b) => a - b);
  // Cycles du parcours : après chaque session intermédiaire, une Mission
  // Terrain (engagement public) puis les 3 entrées à créneaux du Journal.
  const perPeriod = entriesPerPeriod(participant.module.level);
  const now = Date.now();
  const cycles = Array.from({ length: shape.periods }, (_, i) => {
    const idx = i + 1;
    const session = participant.module.sessions.find((s) => s.index === idx);
    const heldAt = session?.heldAt ?? null;
    return {
      index: idx,
      sessionHeldAt: heldAt,
      mission: missions.find((m) => m.sessionIndex === idx) ?? null,
      journal: Array.from({ length: perPeriod }, (_, k) => {
        const entryIndex = k + 1;
        const opensAt = heldAt ? journalSlotOpensAt(heldAt, entryIndex) : null;
        return {
          entryIndex,
          opensAt,
          open: Boolean(opensAt && opensAt.getTime() <= now),
          entry: journal.find((e) => e.periodIndex === idx && e.entryIndex === entryIndex) ?? null,
        };
      }),
    };
  });
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
    cycles,
    certification, credential,
    selfAssessment: selfAssessmentView(selfAssessments, participant, Boolean(certification)),
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

// ---------------------------------------------------------------------------
// Palier 2 — auto-évaluation d'entrée/sortie (K-SPEM)
// ---------------------------------------------------------------------------

type SelfRow = { phase: string; score: number; comment: string | null; updatedAt: Date };

const lastSessionHeld = (participant: { module: { level: number; sessions: { index: number; heldAt: Date | null }[] } }) => {
  const shape = f2fShape(participant.module.level);
  return Boolean(participant.module.sessions.find((s) => s.index === shape.sessions)?.heldAt);
};

function selfAssessmentView(rows: SelfRow[], participant: Parameters<typeof session1Held>[0] & Parameters<typeof lastSessionHeld>[0], sealed: boolean) {
  const entry = rows.find((r) => r.phase === "ENTRY") ?? null;
  const exit = rows.find((r) => r.phase === "EXIT") ?? null;
  return {
    entry: entry ? { score: entry.score, comment: entry.comment, updatedAt: entry.updatedAt, frozen: session1Held(participant) } : null,
    exit: exit ? { score: exit.score, comment: exit.comment, updatedAt: exit.updatedAt, frozen: sealed } : null,
    delta: entry && exit ? exit.score - entry.score : null,
    entryOpen: !session1Held(participant),
    exitOpen: lastSessionHeld(participant) && !sealed,
  };
}

/** Auto-évaluation K-SPEM : ENTRY saisie en Session 1 (figée dès la session
 *  tenue, même règle que la fiche d'ancrage) ; EXIT saisie en session finale
 *  (ouverte une fois la dernière session tenue, figée par la décision
 *  certifiante). Score 1..10 = confiance déclarée sur la compétence visée. */
export async function upsertSelfAssessment(
  participantId: string,
  input: { phase: "ENTRY" | "EXIT"; score: number; comment?: string },
  principal: Principal,
) {
  const participant = await loadParticipant(participantId);
  assertSelf(participant, principal);
  if (!Number.isInteger(input.score) || input.score < F2F_SELF_SCORE_MIN || input.score > F2F_SELF_SCORE_MAX) {
    throw new F2fError(422, "bad_score", `Score attendu entre ${F2F_SELF_SCORE_MIN} et ${F2F_SELF_SCORE_MAX}`);
  }
  if (input.phase === "ENTRY" && session1Held(participant)) {
    throw new F2fError(423, "entry_frozen", "L'auto-évaluation d'entrée est figée depuis la fin de la Session 1.");
  }
  if (input.phase === "EXIT") {
    if (!lastSessionHeld(participant)) {
      throw new F2fError(423, "exit_locked", "L'auto-évaluation de sortie se remplit en session finale — la dernière session n'est pas encore tenue.");
    }
    const sealed = await prisma.f2fCertification.findUnique({ where: { participantId }, select: { id: true } });
    if (sealed) throw new F2fError(423, "exit_frozen", "L'auto-évaluation de sortie est figée : la décision certifiante est prononcée.");
  }
  return prisma.f2fSelfAssessment.upsert({
    where: { participantId_phase: { participantId, phase: input.phase } },
    update: { score: input.score, comment: input.comment?.trim() || null },
    create: { participantId, phase: input.phase, score: input.score, comment: input.comment?.trim() || null },
  });
}

export async function getSelfAssessments(participantId: string, principal: Principal) {
  const participant = await loadParticipant(participantId);
  assertReadAccess(participant, principal);
  const [rows, certification] = await Promise.all([
    prisma.f2fSelfAssessment.findMany({ where: { participantId } }),
    prisma.f2fCertification.findUnique({ where: { participantId }, select: { id: true } }),
  ]);
  return selfAssessmentView(rows, participant, Boolean(certification));
}

// ---------------------------------------------------------------------------
// Palier 2 — indicateurs K-SPEM (console)
// ---------------------------------------------------------------------------

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Indicateurs K-SPEM agrégés : vue globale + une ligne par module. Staff. */
export async function f2fKpis(principal: Principal) {
  if (!isStaff(principal)) throw new F2fError(403, "forbidden", "Réservé au personnel");
  const modules = await prisma.f2fModule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sessions: { orderBy: { index: "asc" }, include: { attendance: { where: { present: true }, select: { participantId: true } } } },
      participants: {
        include: {
          anchor: { select: { id: true } },
          certification: { select: { decision: true, scoreTotal: true } },
          selfAssessments: true,
          _count: { select: { journal: true, missions: true } },
        },
      },
    },
  });

  const rows = modules.map((m) => {
    const shape = f2fShape(m.level);
    const active = m.participants.filter((p) => p.status !== "WITHDRAWN");
    const held = m.sessions.filter((s) => s.heldAt);
    const expectedAttendance = held.length * active.length;
    const presentTotal = held.reduce((sum, s) => sum + s.attendance.length, 0);
    const decided = active.filter((p) => p.certification);
    const certified = decided.filter((p) => p.certification!.decision === "CERTIFIED");
    const entries = active.map((p) => {
      const e = p.selfAssessments.find((x) => x.phase === "ENTRY");
      const x = p.selfAssessments.find((y) => y.phase === "EXIT");
      return { entry: e?.score ?? null, exit: x?.score ?? null };
    });
    const deltas = entries.filter((e) => e.entry != null && e.exit != null).map((e) => e.exit! - e.entry!);
    return {
      id: m.id, title: m.title, level: m.level, status: m.status, shape,
      participants: active.length,
      sessionsHeld: held.length,
      presenceRatePct: expectedAttendance ? Math.round((presentTotal / expectedAttendance) * 100) : null,
      journal: {
        total: active.reduce((sum, p) => sum + p._count.journal, 0),
        avgPerParticipant: avg(active.map((p) => p._count.journal)),
        target: shape.journalMin,
        onTrack: active.filter((p) => p._count.journal >= entriesPerPeriod(m.level) * Math.max(0, Math.min(held.length - 1, shape.periods))).length,
      },
      missions: {
        engaged: active.reduce((sum, p) => sum + p._count.missions, 0),
        expected: Math.min(held.length, shape.sessions - 1) * active.length,
      },
      anchors: active.filter((p) => p.anchor).length,
      certification: {
        decided: decided.length,
        certified: certified.length,
        resubmit: decided.filter((p) => p.certification!.decision === "RESUBMIT").length,
        notCertified: decided.filter((p) => p.certification!.decision === "NOT_CERTIFIED").length,
        avgScore: avg(decided.map((p) => p.certification!.scoreTotal)),
      },
      selfAssessment: {
        avgEntry: avg(entries.filter((e) => e.entry != null).map((e) => e.entry!)),
        avgExit: avg(entries.filter((e) => e.exit != null).map((e) => e.exit!)),
        avgDelta: avg(deltas),
        pairs: deltas.length,
      },
    };
  });

  const decidedAll = rows.reduce((s, r) => s + r.certification.decided, 0);
  const certifiedAll = rows.reduce((s, r) => s + r.certification.certified, 0);
  return {
    global: {
      modules: rows.length,
      activeModules: rows.filter((r) => r.status === "ACTIVE").length,
      participants: rows.reduce((s, r) => s + r.participants, 0),
      certified: certifiedAll,
      certificationRatePct: decidedAll ? Math.round((certifiedAll / decidedAll) * 100) : null,
      journalEntries: rows.reduce((s, r) => s + r.journal.total, 0),
      avgDelta: avg(rows.filter((r) => r.selfAssessment.avgDelta != null).map((r) => r.selfAssessment.avgDelta!)),
    },
    modules: rows,
  };
}

// ---------------------------------------------------------------------------
// Palier 2 — rappels programmés (convocations J-7/J-1, relance journal)
// ---------------------------------------------------------------------------

/** Réserve une clé de rappel — false si ce rappel est déjà parti (dédup). */
async function claimReminder(key: string): Promise<boolean> {
  try { await prisma.f2fReminder.create({ data: { key } }); return true; }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

const fmtFr = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Job horaire des rappels FACE2FACE (K-SPEM, palier 2) :
 *  - convocation J-7 puis rappel J-1 avant chaque session planifiée non tenue,
 *    à chaque participant actif de la cohorte ;
 *  - relance journal « bienveillante » à mi-période aux participants sous
 *    2 entrées (période courante = dernière session tenue → prochaine
 *    planifiée, 4 semaines par défaut).
 * Idempotent : chaque envoi est dédupliqué par clé (F2fReminder).
 */
export async function runF2fReminders(now: Date = new Date()) {
  const modules = await prisma.f2fModule.findMany({
    where: { status: "ACTIVE" },
    include: {
      sessions: { orderBy: { index: "asc" } },
      participants: { where: { status: "ACTIVE" }, include: { user: { select: { name: true, email: true } } } },
    },
  });
  let convocations = 0, nudges = 0;

  for (const m of modules) {
    const shape = f2fShape(m.level);

    // --- convocations J-14, puis rappels J-7 et J-1 ---
    for (const s of m.sessions) {
      if (!s.scheduledAt || s.heldAt) continue;
      const stage = convocationStage(s.scheduledAt, now);
      if (stage === 0) continue;
      const label = (["J14", "J7", "J1"] as const)[stage - 1]!;
      const where = s.location ?? m.location;
      for (const p of m.participants) {
        if (!(await claimReminder(`f2f:convoke:${s.id}:${p.id}:${label}`))) continue;
        const subject = stage === 1
          ? `Convocation — ${s.title} · ${m.title}`
          : stage === 2
            ? `Rappel — votre session approche (${s.title})`
            : `Rappel — votre session a lieu demain (${s.title})`;
        const body =
          `Bonjour ${p.user.name},\n\n` +
          (stage === 1
            ? `Vous êtes convoqué·e à votre prochaine session présentielle :\n\n`
            : stage === 2
              ? `Votre session présentielle a lieu dans une semaine :\n\n`
              : `Dernier rappel — votre session présentielle a lieu demain :\n\n`) +
          `  ${s.title} — ${m.title} (Niveau ${m.level} · ${shape.label})\n` +
          `  ${fmtFr(s.scheduledAt)}${where ? `\n  Lieu : ${where}` : ""}\n  Durée : ${Math.round(s.durationMin / 60)} h\n\n` +
          `La présence à chaque session complète est une condition de certification (K-SPEM §6). ` +
          `Pensez à apporter vos situations terrain : le Partage terrain ouvre la session.\n\n` +
          `KOMPETENCES FACE2FACE — L'apprentissage par l'échange et l'immersion totale`;
        await enqueueNotification({ recipientKind: "LEARNER", recipient: p.user.email, subject, body, provider: "f2f-reminder" });
        convocations++;
      }
    }

    // --- ouverture des entrées du Journal (déclencheurs hebdomadaires) ---
    // L'entrée k s'ouvre à J+7·k après la session de la période ; le
    // participant est prévenu une fois, comme sur les parcours DECLICK.
    const perPeriod = entriesPerPeriod(m.level);
    const participantIds = m.participants.map((p) => p.id);
    const doneRows = participantIds.length
      ? await prisma.f2fJournalEntry.findMany({
          where: { participantId: { in: participantIds } },
          select: { participantId: true, periodIndex: true, entryIndex: true },
        })
      : [];
    const done = new Set(doneRows.map((r) => `${r.participantId}:${r.periodIndex}:${r.entryIndex}`));
    for (const s of m.sessions) {
      if (!s.heldAt || s.index > shape.periods) continue;
      for (let k = 1; k <= perPeriod; k++) {
        const opensAt = journalSlotOpensAt(s.heldAt, k);
        if (opensAt.getTime() > now.getTime()) continue;
        for (const p of m.participants) {
          if (done.has(`${p.id}:${s.index}:${k}`)) continue;
          if (!(await claimReminder(`f2f:jslot:${p.id}:p${s.index}e${k}`))) continue;
          await enqueueNotification({
            recipientKind: "LEARNER", recipient: p.user.email, provider: "f2f-reminder",
            subject: `Votre entrée de Journal de Bord n°${k} est ouverte — ${m.title}`,
            body:
              `Bonjour ${p.user.name},\n\n` +
              `L'entrée n°${k} de la période terrain ${s.index} de « ${m.title} » est ouverte ` +
              `depuis le ${fmtFr(opensAt)}.\n\n` +
              `Quelques minutes suffisent : une situation vécue cette semaine, ce que vous avez fait ` +
              `délibérément, ce que vous avez observé, ce que vous en apprenez. L'entrée est figée à la ` +
              `soumission — c'est votre matière pour le Partage terrain de la prochaine session.\n\n` +
              `Votre espace : ${env.F2F_APP_URL}\n\n` +
              `KOMPETENCES FACE2FACE — L'apprentissage par l'échange et l'immersion totale`,
          });
          nudges++;
        }
      }
    }

    // --- relance journal à mi-période ---
    const held = m.sessions.filter((s) => s.heldAt);
    const period = Math.min(held.length, shape.periods);
    if (period >= 1 && held.length < shape.sessions) {
      const start = m.sessions.find((s) => s.index === period)?.heldAt ?? null;
      const next = m.sessions.find((s) => s.index === period + 1);
      const end = next?.scheduledAt ?? (start ? new Date(start.getTime() + 28 * 864e5) : null);
      if (start && end) {
        for (const p of m.participants) {
          const entries = await prisma.f2fJournalEntry.count({ where: { participantId: p.id, periodIndex: period } });
          if (!journalNudgeDue({ periodStart: start, periodEnd: end, now, entries })) continue;
          if (!(await claimReminder(`f2f:journal:${m.id}:${p.id}:p${period}`))) continue;
          const target = entriesPerPeriod(m.level);
          const subject = `Votre Journal de Bord — période ${period} (${entries}/${target} entrées)`;
          const body =
            `Bonjour ${p.user.name},\n\n` +
            `Nous sommes à mi-parcours de la période terrain ${period} de « ${m.title} » et votre Journal de Bord ` +
            `compte ${entries} entrée${entries > 1 ? "s" : ""} sur les ${target} attendues avant la prochaine session.\n\n` +
            `Quelques minutes suffisent : une situation vécue, ce que vous avez fait délibérément, ce que vous avez ` +
            `observé, ce que vous en apprenez. La qualité d'observation compte plus que la quantité — et le Partage ` +
            `terrain s'ouvre sur vos entrées.\n\n` +
            `KOMPETENCES FACE2FACE — L'apprentissage par l'échange et l'immersion totale`;
          await enqueueNotification({ recipientKind: "LEARNER", recipient: p.user.email, subject, body, provider: "f2f-reminder" });
          nudges++;
        }
      }
    }
  }
  return { modules: modules.length, convocations, nudges };
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
