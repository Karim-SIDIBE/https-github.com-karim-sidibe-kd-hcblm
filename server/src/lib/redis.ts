/**
 * redis.ts — optional shared Redis client (ioredis).
 *
 * Returns a singleton client when REDIS_URL is configured, else null. Used to make
 * the per-process state (rate-limit counter, SAML request-id cache) shared across
 * workers/nodes so the app can scale horizontally. Graceful: with no REDIS_URL the
 * app runs single-process with in-memory state exactly as before.
 */
import Redis from "ioredis";
import { env } from "../config/env.js";

let client: Redis | null = null;
let initialized = false;

export function getRedis(): Redis | null {
  if (initialized) return client;
  initialized = true;
  if (!env.REDIS_URL) return null;
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    lazyConnect: false,
  });
  // Don't let a Redis blip crash the process; the rate-limiter degrades on error.
  client.on("error", () => { /* surfaced by the plugin/consumer as needed */ });
  return client;
}
