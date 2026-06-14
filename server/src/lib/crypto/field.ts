/**
 * field.ts — application-level encryption for sensitive columns (defence in
 * depth: a database-only leak does not expose the plaintext). AES-256-GCM with
 * a 32-byte key from FIELD_ENCRYPTION_KEY (base64). Values are tagged `enc:v1:`
 * so legacy plaintext and future versions can coexist during migration.
 *
 * Graceful: with no key configured, encryptField is a pass-through (plaintext),
 * so dev/test still run — but production MUST set the key.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

const PREFIX = "enc:v1:";

export function isEncrypted(s: string | null | undefined): boolean {
  return typeof s === "string" && s.startsWith(PREFIX);
}

/** Pure core (explicit key) — unit-tested without touching env. */
export function encryptWith(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptWith(key: Buffer, stored: string): string {
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

let warned = false;
function envKey(): Buffer | null {
  const k = env.FIELD_ENCRYPTION_KEY;
  if (!k) {
    if (!warned) { warned = true; console.warn("[crypto] FIELD_ENCRYPTION_KEY non défini — les champs sensibles (secret 2FA) sont stockés en clair. À définir en production."); }
    return null;
  }
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY doit faire 32 octets (base64) — générez avec: openssl rand -base64 32");
  return b;
}

/** Encrypt for storage (pass-through if no key configured). */
export function encryptField(plain: string): string {
  const k = envKey();
  return k ? encryptWith(k, plain) : plain;
}

/** Decrypt a stored value; legacy plaintext (no prefix) is returned as-is. */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const k = envKey();
  if (!k) throw new Error("FIELD_ENCRYPTION_KEY requis pour déchiffrer une valeur chiffrée");
  return decryptWith(k, stored);
}
