/**
 * saml.ts — SAML 2.0 Service Provider connector (enterprise SSO).
 *
 * SP-initiated flow: `getLoginUrl` builds the AuthnRequest redirect to the IdP;
 * the IdP POSTs a signed SAMLResponse to our ACS, validated by `validateAcs`
 * (signature checked against the IdP certificate). `metadata` exposes SP metadata
 * for IdP configuration. Disabled (no-op) unless SAML_* env vars are set.
 *
 * After a valid assertion the platform issues its OWN first-party tokens, so the
 * rest of the API keeps using the existing Bearer-JWT scheme unchanged.
 */
import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { env, samlEnabled } from "../../config/env.js";
import { getRedis } from "../redis.js";
import { redisSamlCache } from "./saml-cache.js";

export type SamlProfile = { email: string | null; name: string | null; nameID?: string };

const REQUEST_ID_TTL_MS = 10 * 60_000; // 10 min — an AuthnRequest's response window

let instance: SAML | undefined;

function saml(): SAML {
  if (!samlEnabled) throw new Error("SAML non configuré");
  // Share the InResponseTo request-id cache via Redis when configured, so the
  // anti-replay correlation stays coherent across cluster workers / API nodes.
  const redis = getRedis();
  instance ??= new SAML({
    entryPoint: env.SAML_ENTRY_POINT!,
    issuer: env.SAML_ISSUER,
    callbackUrl: env.SAML_CALLBACK_URL!,
    idpCert: env.SAML_IDP_CERT!,
    wantAssertionsSigned: true,
    // Enforce the assertion's <AudienceRestriction> names our SP entityID, so a
    // validly-signed assertion the IdP minted for a DIFFERENT relying party is
    // rejected here (prevents cross-SP assertion replay).
    audience: env.SAML_ISSUER,
    // Correlate the SAMLResponse to an AuthnRequest we issued (single-use request
    // IDs) → blocks replay of a captured SP-initiated assertion. "ifPresent" still
    // allows IdP-initiated SSO (no InResponseTo).
    validateInResponseTo: ValidateInResponseTo.ifPresent,
    requestIdExpirationPeriodMs: REQUEST_ID_TTL_MS,
    ...(redis ? { cacheProvider: redisSamlCache(redis, REQUEST_ID_TTL_MS) } : {}),
    disableRequestedAuthnContext: true,
  });
  return instance;
}

export async function getLoginUrl(relayState = ""): Promise<string> {
  return saml().getAuthorizeUrlAsync(relayState, undefined as never, {});
}

const EMAIL_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
const NAME_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Map a validated SAML assertion profile to an identity (pure, testable). */
export function extractIdentity(p: Record<string, unknown>): SamlProfile {
  const nameID = str(p.nameID) ?? undefined;
  const email = str(p.email) ?? (nameID && /@/.test(nameID) ? nameID : null) ?? str(p[EMAIL_CLAIM]);
  const name = str(p.displayName) ?? str(p[NAME_CLAIM]);
  return { email, name, nameID };
}

export async function validateAcs(samlResponse: string): Promise<SamlProfile> {
  const { profile } = await saml().validatePostResponseAsync({ SAMLResponse: samlResponse });
  if (!profile) throw new Error("Assertion SAML vide");
  return extractIdentity(profile as Record<string, unknown>);
}

export function metadata(): string {
  return saml().generateServiceProviderMetadata(null, null);
}
