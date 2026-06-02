/**
 * tutor.service.ts — orchestrates the grounded AI tutor.
 *
 * Retrieves relevant passages from the enrolment's course (semantic search),
 * generates a grounded, PAM-personalized answer, and persists the conversation.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { search } from "../search/search.service.js";
import { answer, type Turn, type RetrievedChunk } from "../../lib/ai/tutor.js";

export class TutorError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

async function loadEnrollment(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!e) throw new TutorError(404, "not_found", "Inscription introuvable");
  return e;
}

export async function ask(enrollmentId: string, question: string, sessionId?: string) {
  const enrollment = await loadEnrollment(enrollmentId);

  // Session (continue or create), scoped to the enrolment.
  let session = sessionId
    ? await prisma.tutorSession.findFirst({ where: { id: sessionId, enrollmentId } })
    : null;
  if (sessionId && !session) throw new TutorError(404, "no_session", "Session introuvable");
  session ??= await prisma.tutorSession.create({ data: { enrollmentId, title: question.slice(0, 80) } });

  const history: Turn[] = (await prisma.tutorMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" }, take: 12 }))
    .map((m) => ({ role: m.role, content: m.content }));

  // Retrieve grounded context from the course.
  const hits = await search(question, { courseId: enrollment.courseId, k: 5 });
  const chunks: RetrievedChunk[] = hits.map((h) => ({ score: h.score, blockIndex: h.blockIndex, path: h.path, text: h.text }));

  const result = await answer(question, chunks, history, enrollment.momentAncrage);

  // Persist the exchange.
  await prisma.tutorMessage.create({ data: { sessionId: session.id, role: "USER", content: question } });
  const assistant = await prisma.tutorMessage.create({
    data: { sessionId: session.id, role: "ASSISTANT", content: result.text, grounded: result.grounded, citations: result.citations as unknown as Prisma.InputJsonValue },
  });
  await prisma.tutorSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });

  return {
    sessionId: session.id,
    answer: result.text,
    grounded: result.grounded,
    aiGenerated: result.aiGenerated,
    provider: result.provider,
    citations: result.citations,
    messageId: assistant.id,
  };
}

export async function listSessions(enrollmentId: string) {
  await loadEnrollment(enrollmentId);
  return prisma.tutorSession.findMany({
    where: { enrollmentId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { messages: true } } },
  });
}

export async function getSession(enrollmentId: string, sessionId: string) {
  const session = await prisma.tutorSession.findFirst({
    where: { id: sessionId, enrollmentId }, include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new TutorError(404, "no_session", "Session introuvable");
  return session;
}
