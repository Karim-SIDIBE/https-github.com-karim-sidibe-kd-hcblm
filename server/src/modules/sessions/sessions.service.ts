/**
 * sessions.service.ts — blended / instructor-led live sessions.
 *
 * Creating a session provisions a meeting (Zoom/Teams) or stores a manual link.
 * Learners register; the host marks attendance. When a session is tied to a
 * course, attendance emits an xAPI `attended` statement for enrolled learners
 * (interoperable blended-learning analytics).
 */
import { MeetingProvider, Prisma, type SessionStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { provisionMeeting, type Provider } from "../../lib/meetings/provider.js";
import { activityId, buildStatement } from "../../domain/engine/xapi.js";

export class SessionError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const toLibProvider = (p: MeetingProvider): Provider => p.toLowerCase() as Provider;
const toEnumProvider = (p: Provider): MeetingProvider => p.toUpperCase() as MeetingProvider;

export type CreateSessionInput = {
  title: string;
  description?: string;
  provider: MeetingProvider;
  startsAt: Date;
  durationMin: number;
  timezone?: string;
  capacity?: number;
  courseId?: string;
  joinUrl?: string; // for MANUAL
};

export async function createSession(input: CreateSessionInput, hostUserId: string) {
  if (input.courseId) {
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw new SessionError(404, "no_course", "Parcours introuvable");
  }
  let meeting;
  try {
    meeting = await provisionMeeting(toLibProvider(input.provider), { topic: input.title, startsAt: input.startsAt, durationMin: input.durationMin }, input.joinUrl);
  } catch (e) {
    if (e instanceof Error && e.message === "manual_join_url_required") {
      throw new SessionError(422, "join_url_required", "Un lien de réunion (joinUrl) est requis pour le mode manuel");
    }
    throw new SessionError(502, "provider_error", `Échec de création de la réunion : ${e instanceof Error ? e.message : e}`);
  }

  return prisma.liveSession.create({
    data: {
      courseId: input.courseId ?? null,
      title: input.title,
      description: input.description ?? null,
      provider: toEnumProvider(meeting.provider),
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      timezone: input.timezone ?? "UTC",
      capacity: input.capacity ?? null,
      joinUrl: meeting.joinUrl,
      externalMeetingId: meeting.externalMeetingId,
      hostUserId,
    },
  });
}

export async function listSessions(opts: { courseId?: string; upcoming?: boolean } = {}) {
  return prisma.liveSession.findMany({
    where: {
      ...(opts.courseId ? { courseId: opts.courseId } : {}),
      ...(opts.upcoming ? { startsAt: { gte: new Date() }, status: { in: ["SCHEDULED", "LIVE"] } } : {}),
    },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { registrations: true } } },
  });
}

export async function getSession(id: string) {
  const s = await prisma.liveSession.findUnique({ where: { id }, include: { _count: { select: { registrations: true } } } });
  if (!s) throw new SessionError(404, "not_found", "Session introuvable");
  return s;
}

/** Register a learner (self or staff-on-behalf). Capacity-checked. */
export async function register(sessionId: string, userId: string) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId }, include: { _count: { select: { registrations: true } } } });
  if (!session) throw new SessionError(404, "not_found", "Session introuvable");
  if (session.status === "CANCELLED") throw new SessionError(409, "cancelled", "Session annulée");
  if (session.capacity != null && session._count.registrations >= session.capacity) {
    throw new SessionError(409, "full", "Session complète");
  }
  try {
    return await prisma.sessionRegistration.create({ data: { sessionId, userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SessionError(409, "already_registered", "Déjà inscrit à cette session");
    }
    throw e;
  }
}

export async function roster(sessionId: string) {
  await getSession(sessionId);
  return prisma.sessionRegistration.findMany({
    where: { sessionId }, orderBy: { registeredAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

/** Mark attendance; emit xAPI `attended` for enrolled learners (blended courses). */
export async function markAttendance(sessionId: string, entries: { userId: string; minutes?: number }[]) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new SessionError(404, "not_found", "Session introuvable");

  let attendanceMarked = 0;
  let xapiEmitted = 0;
  for (const e of entries) {
    const reg = await prisma.sessionRegistration.updateMany({
      where: { sessionId, userId: e.userId },
      data: { attended: true, attendanceMinutes: e.minutes ?? session.durationMin },
    });
    if (reg.count === 0) continue;
    attendanceMarked += reg.count;
    if (await emitAttended(session.id, session.title, session.courseId, e.userId)) xapiEmitted++;
  }
  await prisma.liveSession.update({ where: { id: sessionId }, data: { status: "ENDED" } });
  return { attendanceMarked, xapiEmitted };
}

/** Emit an xAPI `attended` statement when the learner is enrolled in the course. */
async function emitAttended(sessionId: string, title: string, courseId: string | null, userId: string): Promise<boolean> {
  if (!courseId) return false; // xAPI statements are enrolment-scoped
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { user: true, course: true },
  });
  if (!enrollment) return false;
  const objectId = activityId(enrollment.course.slug, ["sessions", sessionId]);
  const statement = buildStatement({
    actor: { name: enrollment.user.name, userId },
    verb: "attended", objectId, objectName: `Session live : ${title}`,
    result: { completion: true },
    enrollmentId: enrollment.id,
  });
  await prisma.xapiStatement.create({
    data: { enrollmentId: enrollment.id, verb: "attended", objectId, statement: statement as unknown as Prisma.InputJsonValue },
  });
  return true;
}

export async function cancelSession(id: string) {
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (!s) throw new SessionError(404, "not_found", "Session introuvable");
  return prisma.liveSession.update({ where: { id }, data: { status: "CANCELLED" as SessionStatus } });
}
