/**
 * draft.ts — brouillon local auto-sauvegardé (retours de test, P3).
 *
 * Ce que l'apprenant tape n'est envoyé au serveur qu'à la validation ; avant
 * cela, quitter l'écran (retour, coupure, onglet fermé) perdait tout. Chaque
 * saisie est donc mise en brouillon, par inscription + item : restaurée au
 * retour sur l'écran tant qu'aucune soumission n'existe, purgée à la
 * soumission réussie.
 *
 * Persistance : IndexedDB (base dédiée « klms-drafts »), comme le reste du
 * stockage hors-ligne de la PWA — PAS localStorage, qui est réservé aux
 * données de session et que l'analyse de sécurité traite comme un espace
 * unique (une clé dynamique y serait considérée comme pouvant relire
 * n'importe quelle entrée, y compris l'identité). Les brouillons sont
 * préchargés en mémoire au démarrage (`preloadDrafts`, avant le rendu React)
 * pour garder une lecture synchrone dans les composants ; les écritures vont
 * en mémoire puis en base, en best-effort — IndexedDB indisponible
 * (navigation privée stricte, tests node) dégrade en brouillon mémoire,
 * jamais bloquant.
 */
import { useEffect } from "react";

const DB_NAME = "klms-drafts";
const STORE = "drafts";

const mem = new Map<string, unknown>();
let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** À appeler UNE FOIS avant le rendu (main.tsx) : charge tous les brouillons
 *  en mémoire pour que `loadDraft` reste synchrone dans les composants. */
export async function preloadDrafts(): Promise<void> {
  db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const store = db!.transaction(STORE, "readonly").objectStore(STORE);
      const keys = store.getAllKeys();
      const vals = store.getAll();
      vals.onsuccess = () => {
        const ks = keys.result ?? [];
        (vals.result ?? []).forEach((v: unknown, i: number) => { if (typeof ks[i] === "string") mem.set(ks[i] as string, v); });
        resolve();
      };
      vals.onerror = () => resolve();
    } catch { resolve(); }
  });
}

function persist(key: string, value: unknown | undefined): void {
  if (!db) return;
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    if (value === undefined) store.delete(key); else store.put(value, key);
  } catch { /* best-effort */ }
}

export function loadDraft<T>(key: string | null | undefined): T | null {
  if (!key) return null;
  return (mem.get(key) as T | undefined) ?? null;
}

/** Écrit un brouillon immédiatement (mémoire + base). Exposé pour les tests ;
 *  les composants passent par `useDraft`. */
export function saveDraft(key: string, value: unknown): void {
  mem.set(key, value);
  persist(key, value);
}

export function clearDraft(key: string | null | undefined): void {
  if (!key) return;
  mem.delete(key);
  persist(key, undefined);
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.every(isEmpty);
  if (typeof v === "object") return Object.values(v).every(isEmpty);
  return false;
}

/**
 * Persiste `value` (débouncé à 300 ms) tant que `active` — typiquement « en
 * phase de réponse, sans soumission figée ». Un brouillon redevenu vide est
 * supprimé plutôt que stocké.
 */
export function useDraft(key: string | null | undefined, value: unknown, active = true): void {
  const serialized = JSON.stringify(value ?? null);
  useEffect(() => {
    if (!key || !active) return;
    const id = setTimeout(() => {
      if (isEmpty(value)) clearDraft(key); else saveDraft(key, value);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, serialized]);
}
