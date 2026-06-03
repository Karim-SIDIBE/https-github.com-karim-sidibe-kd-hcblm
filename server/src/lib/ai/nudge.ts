/**
 * ai/nudge.ts — AI-personalized re-engagement nudges (modern-LMS adaptive nudging).
 *
 * Pluggable with graceful degradation:
 *   - when ANTHROPIC_API_KEY is set → a real Claude call produces a warm,
 *     PAM-anchored nudge tuned to the learner's exact progress;
 *   - otherwise → the deterministic template (engine/reengagement.buildMessage),
 *     so the platform always works (offline, tests, no key).
 *
 * The Anthropic call uses prompt caching on the system prompt (stable across
 * learners) to cut cost/latency.
 */
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText, type ClaudeRequest } from "./client.js";
import { buildMessage, type MessageInput, type Stage, type Channel } from "../../domain/engine/reengagement.js";

export type NudgeResult = { body: string; channel: Channel; aiGenerated: boolean; provider: string };

const SYSTEM_PROMPT =
  "Tu es l'assistant d'engagement d'une plateforme d'apprentissage destinée à des professionnels en " +
  "environnements africains (parcours de gestion du temps). Tu écris des messages de relance courts " +
  "(2 phrases maximum), chaleureux, jamais culpabilisants, en français, à la deuxième personne du pluriel. " +
  "Tu t'appuies sur la situation personnelle que l'apprenant a décrite (son « Moment d'Ancrage ») et sur " +
  "l'endroit exact où il s'est arrêté. Tu ne promets rien d'irréaliste et tu invites à reprendre en 15 minutes.";

/** Build the Anthropic Messages API request body (exposed for testing). */
export function buildAnthropicRequest(stage: Stage, input: MessageInput): ClaudeRequest {
  const userText = [
    `Étape de relance : ${stage} (jours d'inactivité croissants).`,
    `Prénom/nom : ${input.learnerName}.`,
    input.momentAncrage ? `Moment d'Ancrage de l'apprenant : « ${input.momentAncrage} ».` : "Moment d'Ancrage : non renseigné.",
    input.resume ? `Position de reprise : « ${input.resume.itemLabel} » dans « ${input.resume.blockTitle} ».` : "Position : début du parcours.",
    input.blockDurationEstimate ? `Durée restante estimée du bloc : ${input.blockDurationEstimate}.` : "",
    "Rédige le message de relance (2 phrases max).",
  ].filter(Boolean).join("\n");

  return {
    model: env.AI_MODEL,
    max_tokens: 200,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  };
}

/** Produce a nudge — AI when configured, deterministic template otherwise. */
export async function generateNudge(stage: Stage, input: MessageInput): Promise<NudgeResult> {
  const template = buildMessage(stage, input);

  if (!aiAvailable()) {
    return { body: template.body, channel: template.channel, aiGenerated: false, provider: "template" };
  }

  try {
    const text = await callClaudeText(buildAnthropicRequest(stage, input));
    // Admin-channel decisions stay with the deterministic logic; AI only refines learner copy.
    return { body: text, channel: template.channel, aiGenerated: true, provider: env.AI_MODEL };
  } catch {
    // Any failure → safe fallback to the template (never block delivery).
    return { body: template.body, channel: template.channel, aiGenerated: false, provider: "template (ai-fallback)" };
  }
}
