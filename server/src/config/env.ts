/** Typed, validated environment configuration. */
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // --- AI (adaptive nudges). Optional: falls back to deterministic templates. ---
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  // --- embeddings for semantic search. Optional: local deterministic fallback. ---
  VOYAGE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),

  // --- notification delivery. Optional: defaults to console. ---
  NOTIFY_WEBHOOK_URL: z.string().url().optional(),
  /// Allowed CORS origins (comma-separated). Unset → reflect any origin (dev).
  CORS_ORIGINS: z.string().optional(),
  /// Mobile-messaging + push gateways (§7.1 — African reach). Optional: console.
  SMS_WEBHOOK_URL: z.string().url().optional(),
  WHATSAPP_WEBHOOK_URL: z.string().url().optional(),
  PUSH_WEBHOOK_URL: z.string().url().optional(),
  /// Transactional e-mail (SMTP). When set, EMAIL is sent via SMTP (priority over
  /// the webhook); else falls back to NOTIFY_WEBHOOK_URL, else console.
  SMTP_URL: z.string().optional(),                  // e.g. smtp://user:pass@host:587
  MAIL_FROM: z.string().optional(),                 // e.g. "DECLICK DIGITAL <no-reply@declick.digital>"
  /// Skip TLS certificate-name verification for SMTP (still encrypted). Needed
  /// for shared hosts whose cert is for the panel domain (e.g. LWS *.lwspanel.com)
  /// while you connect via a vanity hostname (mail.yourdomain). "true" to enable.
  SMTP_TLS_INSECURE: z.enum(["true", "false"]).transform((s) => s === "true").default("false"),
  /// Public base URL of the learner app (for links in invitations/verification).
  APP_BASE_URL: z.string().url().optional(),
  /// Brand name used in transactional messages. Optional.
  BRAND_NAME: z.string().default("DECLICK DIGITAL"),

  // --- Moment d'Ancrage (PAM) capture policy (§6.1). ---
  /// Minimum PAM length enforced server-side (badge condition floor is 50;
  /// the input field accepts ≥ 500 — front-end capacity).
  PAM_MIN_CHARS: z.coerce.number().int().positive().default(50),

  // --- xAPI LRS forwarding. Optional: no-op when unset. ---
  LRS_ENDPOINT: z.string().url().optional(),
  LRS_KEY: z.string().optional(),
  LRS_SECRET: z.string().optional(),

  // --- media pipeline (storage + transcoding). Local FS by default. ---
  MEDIA_DIR: z.string().default(".media"),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(524_288_000), // 500 MB
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(), // CDN base when fronted by one

  // --- blended live sessions (Zoom / Microsoft Teams). Optional: manual links. ---
  MEETING_PROVIDER: z.enum(["zoom", "teams", "manual"]).default("manual"),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_HOST_USER_ID: z.string().default("me"),
  TEAMS_TENANT_ID: z.string().optional(),
  TEAMS_CLIENT_ID: z.string().optional(),
  TEAMS_CLIENT_SECRET: z.string().optional(),
  TEAMS_HOST_USER_ID: z.string().optional(),

  // --- public base + verifiable credentials (Open Badges 2.0 / 3.0) ---
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
  CREDENTIAL_ISSUER_NAME: z.string().default("KOMPETENCES AFRICA"),
  CREDENTIAL_ISSUER_URL: z.string().url().default("https://declick.kompetences.net"),

  // --- authentication (first-party JWT, OAuth 2.1 / OIDC) ---
  AUTH_ISSUER: z.string().default("https://api.declick.kompetences.net"),
  AUTH_AUDIENCE: z.string().default("declick-api"),
  /// ES256 keys (PEM). When unset, an ephemeral keypair is generated at boot (dev).
  AUTH_JWT_PRIVATE_KEY_PEM: z.string().optional(),
  AUTH_JWT_PUBLIC_KEY_PEM: z.string().optional(),
  /// Previous public key (PEM) kept in the JWKS during key rotation.
  AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM: z.string().optional(),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // --- brute-force defences ---
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300), // per IP per minute (global)
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10), // per IP per minute (auth)
  /// Reject passwords found in known breaches (HIBP, k-anonymity). Opt-out for
  /// air-gapped / strict-no-egress deployments; graceful if HIBP is unreachable.
  // NB: use the enum→boolean transform, not z.coerce.boolean() — the latter maps
  // the string "false" to `true` (any non-empty string is truthy), so an operator
  // setting PASSWORD_BREACH_CHECK=false could never actually disable it.
  PASSWORD_BREACH_CHECK: z.enum(["true", "false"]).transform((s) => s === "true").default("true"),
  // --- RGPD data lifecycle (retention / erasure grace period), in days ---
  RGPD_GRACE_DAYS: z.coerce.number().int().nonnegative().default(30),     // restore window before a scheduled erasure is purged
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),  // audit-log (incl. IP) retention
  TOKEN_RETENTION_DAYS: z.coerce.number().int().positive().default(30),   // keep spent/expired refresh tokens this long, then purge
  // --- encryption at rest (application-level field encryption) ---
  FIELD_ENCRYPTION_KEY: z.string().optional(),  // base64 32-byte key; encrypts sensitive columns (TOTP secret). Generate: openssl rand -base64 32
  // --- upload antivirus ---
  CLAMAV_HOST: z.string().optional(),           // clamd host (blank = heuristic-only scan)
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  // Idle timeout for a clamd INSTREAM scan. Large media (a 238 MB video) takes far
  // longer than a few seconds to scan, so the default is generous — an oversized
  // upload otherwise fails with "ClamAV: délai dépassé" and is blocked (fail-closed).
  AV_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  // If a scanner (CLAMAV_HOST) is configured but clamd is unreachable: true = block
  // the upload (secure default), false = allow it (heuristic still applied). Only
  // matters when CLAMAV_HOST is set; with no scanner every upload is heuristic-only.
  AV_FAIL_CLOSED: z.enum(["true", "false"]).transform((s) => s === "true").default("true"),
  /// Trust the reverse proxy (Caddy) so req.ip is the real client IP (correct
  /// rate-limit isolation + audit) instead of the proxy's socket address.
  TRUST_PROXY: z.enum(["true", "false"]).transform((s) => s === "true").default("true"),
  // --- observability ---
  /// Expose Prometheus metrics at GET /metrics (off by default). Scrape internally.
  METRICS_ENABLED: z.enum(["true", "false"]).transform((s) => s === "true").default("false"),
  /// Optional bearer token required to scrape /metrics (recommended if exposed).
  METRICS_TOKEN: z.string().optional(),
  /// Dev-only `x-user-id` auth bypass. Strict opt-in: only enabled when set to
  /// "true" AND NODE_ENV is not production. Unset = disabled (fail-closed).
  AUTH_DEV_HEADER: z
    .enum(["true", "false"]).transform((s) => s === "true").optional(),

  // --- external IdP (enterprise SSO) verified via JWKS. Optional. ---
  OIDC_ISSUER: z.string().optional(),
  OIDC_JWKS_URI: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_JIT_PROVISION: z.enum(["true", "false"]).transform((s) => s === "true").default("false"),

  // --- SAML 2.0 SSO (enterprise IdP via SAML). Optional. ---
  SAML_ENTRY_POINT: z.string().url().optional(), // IdP SSO URL
  SAML_ISSUER: z.string().default("declick-api"), // our SP entityID
  SAML_CALLBACK_URL: z.string().url().optional(), // our ACS URL
  SAML_IDP_CERT: z.string().optional(), // IdP signing certificate (PEM/base64)
  SAML_JIT_PROVISION: z.enum(["true", "false"]).transform((s) => s === "true").default("false"),
});

// Treat empty-string env vars as "unset" so blank optional fields (e.g. the
// commented-out webhook/LRS URLs in .env.example) fall back to their default /
// optional handling instead of failing url()/coercion validation.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);
const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.error("Configuration d'environnement invalide :");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === "development";

// Hard-fail: the `x-user-id` authentication bypass must never be enabled in
// production, even explicitly. A misconfigured NODE_ENV must not silently open it.
if (env.AUTH_DEV_HEADER === true && env.NODE_ENV === "production") {
  console.error("AUTH_DEV_HEADER=true est interdit en production (contournement d'authentification x-user-id).");
  process.exit(1);
}

// Encryption at rest must not silently degrade to plaintext in production: without
// FIELD_ENCRYPTION_KEY, sensitive columns (e.g. the TOTP secret) would be stored in
// clear. Fail the boot instead so the misconfiguration is caught immediately.
if (env.NODE_ENV === "production" && !env.FIELD_ENCRYPTION_KEY) {
  console.error("FIELD_ENCRYPTION_KEY est requis en production (chiffrement au repos des colonnes sensibles). Générez-en une : openssl rand -base64 32");
  process.exit(1);
}

/**
 * Dev `x-user-id` header allowed? Strict opt-in — must be explicitly set to
 * "true" AND not production. Previously this defaulted on for any non-production
 * NODE_ENV, so a deployment that forgot NODE_ENV=production was a full auth
 * bypass; it now fails closed unless deliberately enabled.
 */
export const authDevHeader = env.AUTH_DEV_HEADER === true && env.NODE_ENV !== "production";

/** External IdP fully configured? */
export const oidcEnabled = Boolean(env.OIDC_ISSUER && env.OIDC_JWKS_URI && env.OIDC_AUDIENCE);

/** SAML 2.0 SSO fully configured? */
export const samlEnabled = Boolean(env.SAML_ENTRY_POINT && env.SAML_CALLBACK_URL && env.SAML_IDP_CERT);
