/**
 * saml-cache.ts — Redis-backed CacheProvider for node-saml's InResponseTo store.
 *
 * node-saml correlates a SAMLResponse to an AuthnRequest we issued via a cache of
 * request ids (single-use, anti-replay). Its default cache is in-memory, which is
 * incoherent across cluster workers / multiple API nodes: a request minted by one
 * worker won't be found by another. When REDIS_URL is configured we back it with
 * Redis so SP-initiated SAML stays correct at scale.
 */
import type Redis from "ioredis";

// Structural match of @node-saml/node-saml's CacheProvider (avoids importing an
// internal type path): { saveAsync, getAsync, removeAsync }.
export type SamlCacheProvider = {
  saveAsync(key: string, value: string): Promise<{ value: string; createdAt: number } | null>;
  getAsync(key: string): Promise<string | null>;
  removeAsync(key: string | null): Promise<string | null>;
};

export function redisSamlCache(redis: Redis, ttlMs: number): SamlCacheProvider {
  const k = (key: string) => `saml:reqid:${key}`;
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  return {
    async saveAsync(key, value) {
      const item = { value, createdAt: Date.now() };
      // NX = only if absent (request ids are single-use).
      const ok = await redis.set(k(key), JSON.stringify(item), "EX", ttlSec, "NX");
      return ok ? item : null;
    },
    async getAsync(key) {
      const raw = await redis.get(k(key));
      if (!raw) return null;
      try { return (JSON.parse(raw) as { value: string }).value; } catch { return null; }
    },
    async removeAsync(key) {
      if (key == null) return null;
      const n = await redis.del(k(key));
      return n > 0 ? key : null;
    },
  };
}
