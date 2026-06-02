/**
 * forum.service.ts — cohort-scoped discussion forums.
 *
 * Access is membership-based: only members of a cohort (or moderators) read and
 * post in its forum. Moderators (forum:moderate) manage cohorts/memberships and
 * can lock threads + soft-delete any post; authors can edit/delete their own.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { isStaff, hasPermission } from "../../domain/auth/permissions.js";
import type { Principal } from "../../lib/auth.js";

export class ForumError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const isModerator = (p: Principal) => hasPermission(p.role, "forum:moderate") || isStaff(p.role);

async function assertCohortAccess(p: Principal, cohortId: string) {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ForumError(404, "no_cohort", "Cohorte introuvable");
  if (isModerator(p)) return cohort;
  const member = await prisma.cohortMembership.findUnique({ where: { cohortId_userId: { cohortId, userId: p.id } } });
  if (!member) throw new ForumError(403, "not_member", "Réservé aux membres de la cohorte");
  return cohort;
}

// --- cohorts + membership (moderators) --------------------------------------

export async function createCohort(name: string, courseId: string | undefined, createdById: string) {
  if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new ForumError(404, "no_course", "Parcours introuvable");
  }
  return prisma.cohort.create({ data: { name, courseId: courseId ?? null, createdById } });
}

export async function addMember(cohortId: string, userId: string) {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ForumError(404, "no_cohort", "Cohorte introuvable");
  try {
    return await prisma.cohortMembership.create({ data: { cohortId, userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ForumError(409, "already_member", "Déjà membre de la cohorte");
    }
    throw e;
  }
}

export async function removeMember(cohortId: string, userId: string) {
  await prisma.cohortMembership.deleteMany({ where: { cohortId, userId } });
  return { ok: true };
}

/** Cohorts the principal can see: their own memberships, or all for moderators. */
export async function listCohorts(p: Principal) {
  if (isModerator(p)) {
    return prisma.cohort.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { memberships: true, threads: true } } } });
  }
  return prisma.cohort.findMany({
    where: { memberships: { some: { userId: p.id } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true, threads: true } } },
  });
}

// --- threads + posts (members) ----------------------------------------------

export async function listThreads(p: Principal, cohortId: string) {
  await assertCohortAccess(p, cohortId);
  return prisma.forumThread.findMany({
    where: { cohortId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: { author: { select: { id: true, name: true } }, _count: { select: { posts: true } } },
  });
}

export async function createThread(p: Principal, cohortId: string, title: string, body: string) {
  await assertCohortAccess(p, cohortId);
  return prisma.forumThread.create({
    data: { cohortId, authorId: p.id, title, posts: { create: { authorId: p.id, body } } },
    include: { posts: true },
  });
}

export async function getThread(p: Principal, threadId: string) {
  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new ForumError(404, "no_thread", "Fil introuvable");
  await assertCohortAccess(p, thread.cohortId);
  return prisma.forumThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { id: true, name: true } },
      posts: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
    },
  });
}

export async function reply(p: Principal, threadId: string, body: string) {
  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new ForumError(404, "no_thread", "Fil introuvable");
  await assertCohortAccess(p, thread.cohortId);
  if (thread.locked && !isModerator(p)) throw new ForumError(409, "locked", "Fil verrouillé");
  const post = await prisma.forumPost.create({ data: { threadId, authorId: p.id, body } });
  await prisma.forumThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  return post;
}

export async function editPost(p: Principal, postId: string, body: string) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new ForumError(404, "no_post", "Message introuvable");
  if (post.authorId !== p.id && !isModerator(p)) throw new ForumError(403, "forbidden", "Modification réservée à l'auteur");
  return prisma.forumPost.update({ where: { id: postId }, data: { body, editedAt: new Date() } });
}

export async function deletePost(p: Principal, postId: string) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new ForumError(404, "no_post", "Message introuvable");
  if (post.authorId !== p.id && !isModerator(p)) throw new ForumError(403, "forbidden", "Suppression réservée à l'auteur ou à un modérateur");
  return prisma.forumPost.update({ where: { id: postId }, data: { deletedAt: new Date(), body: "[message supprimé]" } });
}

// --- moderation -------------------------------------------------------------

export async function setThreadFlags(threadId: string, flags: { locked?: boolean; pinned?: boolean }) {
  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new ForumError(404, "no_thread", "Fil introuvable");
  return prisma.forumThread.update({ where: { id: threadId }, data: flags });
}
