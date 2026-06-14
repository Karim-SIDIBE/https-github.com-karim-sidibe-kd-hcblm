/**
 * totp.ts — RFC 6238 TOTP (time-based one-time password), pure Node crypto.
 *
 * Dependency-free (smaller attack surface). Compatible with Google/Microsoft
 * Authenticator, FreeOTP, etc.: HMAC-SHA1, 6 digits, 30s step, base32 secret.
 * Validated against the RFC 6238 Appendix B test vectors (see totp.test.ts).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/,"").replace(/\s+/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("base32 invalide");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** New random base32 secret (default 20 bytes = 160 bits, per RFC 4226). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** RFC 4226 HOTP for a given counter. */
function hotp(secret: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (safe for the lifetime of TOTP).
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

export type TotpOptions = { step?: number; digits?: number; t0?: number; time?: number };

/** Current TOTP code for a base32 secret. */
export function totpCode(secretB32: string, opts: TotpOptions = {}): string {
  const { step = 30, digits = 6, t0 = 0, time = Date.now() } = opts;
  const counter = Math.floor((Math.floor(time / 1000) - t0) / step);
  return hotp(base32Decode(secretB32), counter, digits);
}

/**
 * Verify a presented token, tolerating ±`window` steps of clock drift.
 * Constant-time comparison; returns false on any malformed input.
 */
export function verifyTotp(secretB32: string, token: string, opts: TotpOptions & { window?: number } = {}): boolean {
  const { step = 30, digits = 6, t0 = 0, time = Date.now(), window = 1 } = opts;
  const t = (token ?? "").trim();
  if (!/^\d+$/.test(t) || t.length !== digits) return false;
  let secret: Buffer;
  try { secret = base32Decode(secretB32); } catch { return false; }
  const base = Math.floor((Math.floor(time / 1000) - t0) / step);
  const presented = Buffer.from(t);
  for (let w = -window; w <= window; w++) {
    const candidate = Buffer.from(hotp(secret, base + w, digits));
    if (candidate.length === presented.length && timingSafeEqual(candidate, presented)) return true;
  }
  return false;
}

/** otpauth:// URI for QR provisioning in authenticator apps. */
export function otpauthUrl(secretB32: string, account: string, issuer = "KOMPETENCES DECLICK"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
