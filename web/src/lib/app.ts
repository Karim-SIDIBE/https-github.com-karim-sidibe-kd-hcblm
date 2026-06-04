/**
 * app.ts — wiring: API client, offline store, sync engine, token persistence.
 */
import { createApi } from "./api";
import { idbStore, memStore } from "./store";
import { createEngine } from "./sync";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/v1";
const KEY = "klms_tokens";

export const tokenBox = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } },
  set(t: { access?: string; refresh?: string }) { localStorage.setItem(KEY, JSON.stringify(t)); },
};

export const api = createApi(API_URL, tokenBox);
export const store = typeof indexedDB !== "undefined" ? idbStore() : memStore();
export const engine = createEngine(store, api);

export const isLoggedIn = () => Boolean(tokenBox.get().access);

// Logged-in learner identity — kept only to render the per-learner video
// watermark (anti-leak deterrent). Cleared on logout.
const ME_KEY = "klms_me";
export type Identity = { id: string; name: string; email: string };
export function setIdentity(me: Identity) { try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* quota */ } }
export function getIdentity(): Identity | null { try { return JSON.parse(localStorage.getItem(ME_KEY) || "null"); } catch { return null; } }

export function logout() { localStorage.removeItem(KEY); localStorage.removeItem(ME_KEY); }
