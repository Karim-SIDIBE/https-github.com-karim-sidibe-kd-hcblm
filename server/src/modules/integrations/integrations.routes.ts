/**
 * integrations.routes.ts — one status endpoint for the admin "Intégrations"
 * screen: is SAML/OIDC configured, what URLs does an IdP or LMS need, how many
 * LTI platforms are registered, which organizations have a SCIM token.
 * Secrets never leave the server — only presence flags and public URLs.
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import { env, oidcEnabled, samlEnabled } from "../../config/env.js";
import { guard } from "../../lib/auth.js";

export async function integrationsRoutes(app: FastifyInstance) {
  app.get("/integrations/status", { preHandler: guard("org:manage") }, async () => {
    const base = env.PUBLIC_BASE_URL.replace(/\/$/, "");
    const api = `${base}/api/v1`;
    const [ltiPlatforms, orgs] = await Promise.all([
      prisma.ltiPlatform.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, issuer: true, clientId: true, deploymentId: true, createdAt: true } }),
      prisma.organization.findMany({ select: { id: true, name: true, slug: true, scimTokenHash: true } }),
    ]);
    return {
      data: {
        saml: {
          enabled: samlEnabled,
          issuer: env.SAML_ISSUER,
          jitProvision: env.SAML_JIT_PROVISION,
          entryPointConfigured: Boolean(env.SAML_ENTRY_POINT),
          certConfigured: Boolean(env.SAML_IDP_CERT),
          metadataUrl: `${api}/auth/saml/metadata`,
          loginUrl: `${api}/auth/saml/login`,
          acsUrl: env.SAML_CALLBACK_URL || `${api}/auth/saml/acs`,
        },
        oidc: {
          enabled: oidcEnabled,
          issuer: env.OIDC_ISSUER || null,
          audience: env.OIDC_AUDIENCE || null,
          jitProvision: env.OIDC_JIT_PROVISION,
        },
        lti: {
          configUrl: `${api}/lti/config`,
          jwksUrl: `${api}/lti/jwks`,
          oidcInitiationUrl: `${api}/lti/login`,
          targetLinkUri: `${api}/lti/launch`,
          platforms: ltiPlatforms,
        },
        scim: {
          baseUrl: `${api}/scim/v2`,
          organizations: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, tokenProvisioned: Boolean(o.scimTokenHash) })),
        },
      },
    };
  });
}
