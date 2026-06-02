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

  // --- xAPI LRS forwarding. Optional: no-op when unset. ---
  LRS_ENDPOINT: z.string().url().optional(),
  LRS_KEY: z.string().optional(),
  LRS_SECRET: z.string().optional(),

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
  /// Dev-only `x-user-id` escape hatch. Defaults on outside production.
  AUTH_DEV_HEADER: z
    .enum(["true", "false"]).transform((s) => s === "true").optional(),

  // --- external IdP (enterprise SSO) verified via JWKS. Optional. ---
  OIDC_ISSUER: z.string().optional(),
  OIDC_JWKS_URI: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_JIT_PROVISION: z.enum(["true", "false"]).transform((s) => s === "true").default("false"),
});

const parsed = EnvSchema.safeParse(process.env);
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
