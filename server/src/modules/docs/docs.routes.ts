import type { FastifyInstance } from "fastify";
import { DOCS_HTML, openapiDocument } from "./openapi.js";

export async function docsRoutes(app: FastifyInstance) {
  // Machine-readable contract (public — it's a published API description).
  app.get("/openapi.json", async () => openapiDocument());

  // Human-readable API docs.
  app.get("/docs", async (_req, reply) => {
    return reply.header("content-type", "text/html; charset=utf-8").send(DOCS_HTML);
  });
}
