import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { BankError, approveBankQuestion, createBankQuestion, deleteBankQuestion, distinctSubAreas, importFromCourse, listBankQuestions, randomBankQuestions } from "./bank.service.js";
import { guard } from "../../lib/auth.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof BankError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function bankRoutes(app: FastifyInstance) {
  app.get("/bank/questions", { preHandler: guard("course:read") }, async (req) => {
    const { subArea, status } = z.object({ subArea: z.string().optional(), status: z.enum(["approved", "pending"]).optional() }).parse(req.query ?? {});
    return { data: await listBankQuestions(subArea, status) };
  });

  // Approve a pending (imported/AI) question — it becomes drawable by pools.
  app.post("/bank/questions/:id/approve", { preHandler: guard("course:update") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await approveBankQuestion(id) }; } catch (err) { return handle(reply, err); }
  });

  // Harvest all scored questions of a published course into the bank (idempotent).
  app.post("/bank/import/:courseId", { preHandler: guard("course:update") }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await importFromCourse(courseId, { createdById: req.principal?.id }) }; }
    catch (err) { return handle(reply, err); }
  });

  app.get("/bank/subareas", { preHandler: guard("course:read") }, async () => ({ data: await distinctSubAreas() }));

  app.get("/bank/questions/random", { preHandler: guard("course:read") }, async (req) => {
    const { subArea, count } = z.object({ subArea: z.string().optional(), count: z.coerce.number().int().min(1).max(50).default(5) }).parse(req.query ?? {});
    return { data: await randomBankQuestions(subArea, count) };
  });

  app.post("/bank/questions", { preHandler: guard("course:update") }, async (req, reply) => {
    const body = z.object({ question: z.unknown(), subArea: z.string().optional(), level: z.string().optional() }).parse(req.body);
    try { return reply.status(201).send({ data: await createBankQuestion({ ...body, createdById: req.principal?.id }) }); }
    catch (err) { return handle(reply, err); }
  });

  app.delete("/bank/questions/:id", { preHandler: guard("course:update") }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { data: await deleteBankQuestion(id) };
  });
}
