/**
 * password.ts — Argon2id hashing (OWASP-recommended).
 *
 * Parameters follow the OWASP minimum for Argon2id (m=19 MiB, t=2, p=1). The
 * encoded hash embeds the salt + parameters, so verification is self-describing.
 */
import { hash, verify, Algorithm } from "@node-rs/argon2";

const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/** Constant-time verification; never throws (a malformed hash → false). */
export async function verifyPassword(encodedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}
