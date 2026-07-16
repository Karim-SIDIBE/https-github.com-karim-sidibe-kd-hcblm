import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { guard } from "../../lib/auth.js";
import { overridesFor, resetUiText, setUiText, UiTextError } from "./uitexts.service.js";

const appQuery = z.object({ app: z.string().default("web") });
const body = z.object({
  app: z.string().default("web"),
  locale: z.enum(["fr", "en"]),
  key: z.string().min(1),
  value: z.string(),
});

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof UiTextError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function uiTextRoutes(app: FastifyInstance) {
  // Public read — the learner PWA overlays these on the shared defaults at
  // boot (also pre-login: the login screen texts are editable too).
  app.get("/ui-texts", async (req) => {
    const { app: appName } = appQuery.parse(req.query ?? {});
    return { data: await overridesFor(appName) };
  });

  // Super-admin: override one text (validated against the known keys and
  // required {var} placeholders).
  app.put("/ui-texts", { preHandler: guard("uitexts:manage") }, async (req, reply) => {
    const { app: appName, locale, key, value } = body.parse(req.body);
    try {
      const row = await setUiText(appName, locale, key, value, req.principal?.id);
      await audit({ actorId: req.principal?.id, action: "uitext.set", targetType: "UiText", targetId: `${appName}/${locale}/${key}`, ip: req.ip });
      return { data: row };
    } catch (err) { return handle(reply, err); }
  });

  // Super-admin: revert one text to its default.
  app.delete("/ui-texts", { preHandler: guard("uitexts:manage") }, async (req) => {
    const { app: appName, locale, key } = body.omit({ value: true }).parse(req.body ?? {});
    const removed = await resetUiText(appName, locale as "fr" | "en", key);
    if (removed) await audit({ actorId: req.principal?.id, action: "uitext.reset", targetType: "UiText", targetId: `${appName}/${locale}/${key}`, ip: req.ip });
    return { data: { reverted: removed } };
  });
}
