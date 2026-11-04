/**
 * ai/client.ts — shared Anthropic client helpers.
 *
 * Centralizes availability + the Messages API call so every AI feature (nudges,
 * formative feedback, rubric suggestions) shares one code path with consistent
 * headers, model selection and prompt caching.
 */
import { env } from "../../config/env.js";
import { aiRuntimeEnabled } from "../ai-switch.js";
import { createSas } from "./pseudo.js";

/** Clé configurée ET interrupteur console ouvert — sinon, chaque fonction IA
 *  retombe sur son repli déterministe (débrayage global sans redéploiement). */
export function aiAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY) && aiRuntimeEnabled();
}

export type Effort = "low" | "medium" | "high";

export type ClaudeRequest = {
  model: string;
  max_tokens: number;
  /** Profondeur de réflexion et/ou sortie structurée — voir `effortFor` /
   *  `supportsOutputConfig`. */
  output_config?: {
    effort?: Effort;
    /** Sortie structurée : l'API GARANTIT un JSON valide conforme au schéma —
     *  plus d'échec de parse sur un guillemet non échappé du modèle. */
    format?: { type: "json_schema"; schema: Record<string, unknown> };
  };
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: { role: "user" | "assistant"; content: string }[];
  /** Identifiants CONNUS à pseudonymiser en plus des motifs structurés
   *  (ex. le nom de l'apprenant) — retiré de la requête avant l'envoi. */
  piiKnown?: string[];
};

/** Sas de pseudonymisation : masque tous les textes sortants de la requête
 *  (identifiants structurés + `piiKnown`) et rend la fonction de restitution
 *  à appliquer sur la réponse. Exporté pur pour être testé sans réseau. */
export function applySas(request: ClaudeRequest): { outbound: Omit<ClaudeRequest, "piiKnown">; reinject: (text: string) => string } {
  const sas = createSas(request.piiKnown ?? []);
  const { piiKnown: _piiKnown, ...rest } = request;
  const outbound = {
    ...rest,
    system: rest.system.map((s) => ({ ...s, text: sas.mask(s.text) })),
    messages: rest.messages.map((m) => ({ ...m, content: sas.mask(m.content) })),
  };
  return { outbound, reinject: sas.reinject };
}

/** Modèles qui acceptent `output_config` (effort, format) — l'envoyer à
 *  claude-haiku-4-5 (ou plus ancien) provoque un 400 et ferait tout basculer
 *  sur les replis. */
const OUTPUT_CONFIG_CAPABLE = /^claude-(fable-5|mythos-5|opus-5|opus-4-[5-8]|sonnet-5|sonnet-4-6)/;

export function supportsOutputConfig(model: string): boolean {
  return OUTPUT_CONFIG_CAPABLE.test(model);
}

/** `output_config` à joindre à la requête : l'effort demandé si le modèle le
 *  supporte, sinon rien (le défaut du modèle s'applique). Maîtrise des coûts :
 *  « low » pour les textes courts à fort volume (relances, feedback formatif),
 *  défaut (high) pour la notation certifiante où la justesse prime. */
export function effortFor(model: string, effort: Effort): { effort: Effort } | undefined {
  return supportsOutputConfig(model) ? { effort } : undefined;
}

/** Call Claude and return the concatenated text. Throws on any failure. */
export async function callClaudeText(request: ClaudeRequest): Promise<string> {
  if (!aiAvailable()) throw new Error("ANTHROPIC_API_KEY non configurée ou assistance IA désactivée");
  // Pseudonymisation systématique : aucun identifiant structuré (courriel,
  // téléphone, URL, long numéro) ni identifiant connu ne part au fournisseur ;
  // la table de correspondance reste en mémoire et la réponse est restituée.
  const { outbound, reinject } = applySas(request);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(outbound),
  });
  if (!res.ok) {
    // Le statut seul ne permet aucun diagnostic (clé invalide ? modèle
    // inconnu ? quota ?) — remonter le message de l'API.
    let detail = "";
    try { detail = String(((await res.json()) as { error?: { message?: string } })?.error?.message ?? ""); } catch { /* corps illisible */ }
    throw new Error(`Anthropic ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = json.content?.map((c) => c.text ?? "").join("").trim();
  if (!text) throw new Error("réponse IA vide");
  // Une réponse coupée en plein vol est inutilisable (JSON tronqué) et
  // trompeuse (texte amputé) : mieux vaut échouer que dégrader en silence.
  if (json.stop_reason === "max_tokens") {
    throw new Error(`réponse tronquée à ${request.max_tokens} tokens (stop_reason=max_tokens)`);
  }
  // Restitution : les jetons de pseudonymisation redeviennent les valeurs
  // d'origine — le texte rendu à l'apprenant reste naturel.
  return reinject(text);
}

/**
 * Strip Markdown decoration from learner-facing AI text — the PWA renders
 * plain text (whiteSpace: pre-wrap), so `#`/`**` would show up literally.
 * The prompts already forbid Markdown; this is the guarantee.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // heading markers
    .replace(/^\s*-{3,}\s*$/gm, "")        // horizontal rules
    .replace(/\*\*(.+?)\*\*/g, "$1")       // bold
    .replace(/(^|\s)\*(\S[^*\n]*?)\*(?=[\s.,;:!?)]|$)/g, "$1$2") // italic (keeps « 2 * 3 »)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract the first JSON object/array from a model response (defensive). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("aucun JSON dans la réponse");
  return JSON.parse(raw.slice(start));
}
