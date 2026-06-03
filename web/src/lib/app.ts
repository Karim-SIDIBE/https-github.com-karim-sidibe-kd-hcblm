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
export function logout() { localStorage.removeItem(KEY); }
