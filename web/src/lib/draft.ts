/**
 * draft.ts — brouillon local auto-sauvegardé (retours de test, P3).
 *
 * Ce que l'apprenant tape n'est envoyé au serveur qu'à la validation ; avant
 * cela, quitter l'écran (retour, coupure, onglet fermé) perdait tout. Chaque
 * saisie est donc mise en brouillon dans localStorage, par inscription + item :
 * restaurée au retour sur l'écran tant qu'aucune soumission n'existe, purgée à
 * la soumission réussie. Best-effort : localStorage peut être indisponible
 * (navigation privée) — tout est enveloppé de try/catch, jamais bloquant.
 */
import { useEffect } from "react";

const PREFIX = "kd:draft:";

export function loadDraft<T>(key: string | null | undefined): T | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? ((JSON.parse(raw) as { v: T }).v ?? null) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string | null | undefined): void {
  if (!key) return;
  try { localStorage.removeItem(PREFIX + key); } catch { /* best-effort */ }
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
      try {
        if (isEmpty(value)) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() }));
      } catch { /* best-effort */ }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, serialized]);
}
