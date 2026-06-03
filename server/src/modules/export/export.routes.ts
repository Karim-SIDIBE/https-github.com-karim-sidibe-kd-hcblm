import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ExportError, exportCourse } from "./export.service.js";
import { guard } from "../../lib/auth.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof ExportError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function exportRoutes(app: FastifyInstance) {
  // Export a published course as a portable package (SCORM 1.2 / SCORM 2004 / cmi5 / Common Cartridge).
  app.get("/courses/:id/export", { preHandler: guard("course:read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["scorm12", "scorm2004", "cmi5", "cc"]).default("scorm12") }).parse(req.query);
    try {
      const pkg = await exportCourse(id, format);
      const ext = pkg.filename.endsWith(".imscc") ? "imscc" : "zip";
      return reply.header("content-type", ext === "imscc" ? "application/vnd.ims.imsccv1p3" : "application/zip")
        .header("content-disposition", `attachment; filename="${pkg.filename}"`).send(pkg.buffer);
    } catch (err) { return handle(reply, err); }
  });
}
