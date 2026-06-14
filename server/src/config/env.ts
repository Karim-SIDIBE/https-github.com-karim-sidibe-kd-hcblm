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
  PASSWORD_BREACH_CHECK: z.coerce.boolean().default(true),
  // --- RGPD data lifecycle (retention / erasure grace period), in days ---
  RGPD_GRACE_DAYS: z.coerce.number().int().nonnegative().default(30),     // restore window before a scheduled erasure is purged
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),  // audit-log (incl. IP) retention
  TOKEN_RETENTION_DAYS: z.coerce.number().int().positive().default(30),   // keep spent/expired refresh tokens this long, then purge
  /// Dev-only `x-user-id` escape hatch. Defaults on outside production.
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

/** Dev `x-user-id` header allowed? Explicit flag wins; else on outside production. */
export const authDevHeader = env.AUTH_DEV_HEADER ?? env.NODE_ENV !== "production";

/** External IdP fully configured? */
export const oidcEnabled = Boolean(env.OIDC_ISSUER && env.OIDC_JWKS_URI && env.OIDC_AUDIENCE);

/** SAML 2.0 SSO fully configured? */
export const samlEnabled = Boolean(env.SAML_ENTRY_POINT && env.SAML_CALLBACK_URL && env.SAML_IDP_CERT);
