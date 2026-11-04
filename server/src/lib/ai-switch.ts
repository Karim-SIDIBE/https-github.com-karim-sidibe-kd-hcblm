/**
 * ai-switch.ts — interrupteur GLOBAL des appels IA distants, à chaud.
 *
 * Minuscule module sans dépendance (ni prisma, ni env) pour que la couche
 * lib/ai reste importable dans les tests purs. La valeur vient du réglage
 * `ai_assist_enabled` (console Super Admin) : runtime-config le charge au
 * boot et le rafraîchit toutes les 60 s ; settings.routes le répercute
 * immédiatement dans CE processus à chaque écriture.
 *
 * Coupé, TOUTES les fonctions IA (feedback, tuteur, relances, notation
 * suggérée, autorat, sous-titres, embeddings distants) retombent sur leurs
 * replis déterministes hors-ligne — exactement comme sans clé API.
 */
let enabled = true;

export function aiRuntimeEnabled(): boolean {
  return enabled;
}

export function setAiRuntimeEnabled(value: boolean): void {
  enabled = value;
}
