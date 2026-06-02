import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  ForumError, addMember, createCohort, createThread, deletePost, editPost, getThread,
  listCohorts, listThreads, removeMember, reply as replyToThread, setThreadFlags,
} from "./forum.service.js";
import { authenticate, guard } from "../../lib/auth.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof ForumError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function forumRoutes(app: FastifyInstance) {
  // --- cohorts + membership (moderators) ---
  app.post("/cohorts", { preHandler: guard("forum:moderate") }, async (req, reply) => {
    const { name, courseId } = z.object({ name: z.string().trim().min(1), courseId: z.string().optional() }).parse(req.body);
    try { return reply.status(201).send({ data: await createCohort(name, courseId, req.principal!.id) }); }
    catch (err) { return handle(reply, err); }
  });

  app.get("/cohorts", { preHandler: authenticate }, async (req) => ({ data: await listCohorts(req.principal!) }));

  app.post("/cohorts/:id/members", { preHandler: guard("forum:moderate") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    try { return reply.status(201).send({ data: await addMember(id, userId) }); } catch (err) { return handle(reply, err); }
  });

  app.delete("/cohorts/:id/members/:userId", { preHandler: guard("forum:moderate") }, async (req, reply) => {
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(req.params);
    try { return { data: await removeMember(id, userId) }; } catch (err) { return handle(reply, err); }
  });

  // --- threads + posts (members) ---
  app.get("/cohorts/:id/threads", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await listThreads(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/cohorts/:id/threads", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { title, body } = z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).parse(req.body);
    try { return reply.status(201).send({ data: await createThread(req.principal!, id, title, body) }); } catch (err) { return handle(reply, err); }
  });

  app.get("/threads/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await getThread(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/threads/:id/posts", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1) }).parse(req.body);
    try { return reply.status(201).send({ data: await replyToThread(req.principal!, id, body) }); } catch (err) { return handle(reply, err); }
  });

  app.patch("/posts/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1) }).parse(req.body);
    try { return { data: await editPost(req.principal!, id, body) }; } catch (err) { return handle(reply, err); }
  });

  app.delete("/posts/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await deletePost(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  // --- moderation ---
  app.post("/threads/:id/flags", { preHandler: guard("forum:moderate") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const flags = z.object({ locked: z.boolean().optional(), pinned: z.boolean().optional() }).parse(req.body);
    try { return { data: await setThreadFlags(id, flags) }; } catch (err) { return handle(reply, err); }
  });
}
