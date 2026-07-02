/**
 * ssrf-guard.ts — block server-side request forgery on outbound fetches to
 * operator-/tenant-supplied URLs (outbound webhook delivery).
 *
 * A privileged admin can register a webhook subscription URL; the delivery job
 * then POSTs signed event envelopes to it. Without a guard, that URL could point
 * at loopback, link-local (cloud metadata: 169.254.169.254), or private RFC-1918
 * hosts, turning the server into a request origin against internal services.
 *
 * We reject non-http(s) schemes and any host that resolves to a
 * loopback / link-local / private / unspecified / ULA address. DNS is resolved
 * here so a public hostname that maps to an internal IP is also blocked.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Is this literal IP address in a range we must never fetch from the server? */
export function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const a = p[0]!, b = p[1]!;
    if (a === 0) return true;                       // 0.0.0.0/8 (unspecified/this-network)
    if (a === 10) return true;                      // 10.0.0.0/8 private
    if (a === 127) return true;                     // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;        // 169.254.0.0/16 link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true;        // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                      // multicast / reserved
    return false;
  }
  if (v === 6) {
    const l = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (l === "::1" || l === "::") return true;     // loopback / unspecified
    if (l.startsWith("fe80")) return true;          // link-local
    if (l.startsWith("fc") || l.startsWith("fd")) return true; // unique local (ULA)
    // IPv4-mapped (::ffff:a.b.c.d) → check the embedded v4.
    const m = /::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(l);
    if (m && m[1]) return isBlockedIp(m[1]);
    return false;
  }
  return true; // not a recognizable IP literal → refuse
}

/**
 * Validate a destination URL for an outbound server fetch. Throws
 * `SsrfBlockedError` on a disallowed scheme or an internal/blocked target.
 * Resolves the hostname so DNS-rebinding to an internal IP is also caught.
 */
export async function assertPublicUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfBlockedError(`URL invalide : ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(`Schéma non autorisé : ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal IP host: check directly (no DNS).
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError(`Hôte interne bloqué : ${host}`);
    return;
  }
  // A hostname: resolve every A/AAAA record and block if ANY is internal.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError(`Résolution DNS impossible : ${host}`);
  }
  if (addrs.length === 0) throw new SsrfBlockedError(`Aucune adresse pour : ${host}`);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new SsrfBlockedError(`Hôte résolvant vers une adresse interne bloquée : ${host} → ${a.address}`);
  }
}
