/**
 * tutor.ts — grounded AI tutor (RAG).
 *
 * Answers are grounded in retrieved course passages: Claude when configured, an
 * extractive fallback otherwise (always functional offline). Guardrail: if no
 * passage is relevant enough, the tutor says it can't answer from the course
 * instead of hallucinating. Answers are personalized with the learner's PAM.
 */
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText, type ClaudeRequest } from "./client.js";
import { tokenize } from "./embeddings.js";

export type RetrievedChunk = { score: number; blockIndex: number | null; path: string; text: string };
export type Turn = { role: "USER" | "ASSISTANT"; content: string };
export type TutorAnswer = { text: string; grounded: boolean; aiGenerated: boolean; provider: string; citations: { blockIndex: number | null; path: string; snippet: string }[] };

/** Minimum top similarity to consider the question answerable from the course. */
export const RELEVANCE_THRESHOLD = 0.12;

/**
 * Grounding guard: at least one meaningful (non-stopword) term of the question
 * must actually appear in the retrieved passages. Robust regardless of the
 * embedder (the offline lexical embedder can over-score off-topic queries via
 * hash collisions; interrogatives like "quelle" are stripped as stopwords).
 */
export function isGrounded(question: string, chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  const hay = new Set(chunks.slice(0, 3).flatMap((c) => tokenize(c.text)));
  return tokenize(question).some((t) => hay.has(t));
}

const SYSTEM =
  "Tu es le tuteur IA d'un parcours de formation (gestion du temps en environnements professionnels africains). " +
  "Règles STRICTES : tu réponds UNIQUEMENT à partir des EXTRAITS de cours fournis ci-dessous. " +
  "Si les extraits ne permettent pas de répondre, dis-le honnêtement et invite à reformuler ou à consulter le bloc concerné — n'invente jamais. " +
  "Tu réponds en français, de façon concise et encourageante, et tu cites les blocs utilisés (ex. « Bloc 1 »). " +
  "Quand c'est pertinent, relie ta réponse à la situation personnelle de l'apprenant (son Moment d'Ancrage).";

function contextBlock(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `[#${i + 1} · Bloc ${c.blockIndex ?? "—"} · ${c.path}]\n${c.text}`).join("\n\n");
}

export function buildTutorRequest(question: string, chunks: RetrievedChunk[], history: Turn[], momentAncrage: string | null): ClaudeRequest {
  const hist = history.slice(-6).map((t) => `${t.role === "USER" ? "Apprenant" : "Tuteur"}: ${t.content}`).join("\n");
  const user = [
    momentAncrage ? `Moment d'Ancrage de l'apprenant : « ${momentAncrage} ».` : "",
    hist ? `Conversation précédente :\n${hist}` : "",
    `EXTRAITS DU COURS :\n${contextBlock(chunks)}`,
    `QUESTION : ${question}`,
  ].filter(Boolean).join("\n\n");

  return {
    model: env.AI_MODEL,
    max_tokens: 700,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}

function citationsOf(chunks: RetrievedChunk[]) {
  return chunks.map((c) => ({ blockIndex: c.blockIndex, path: c.path, snippet: c.text.slice(0, 160) }));
}

function extractiveAnswer(chunks: RetrievedChunk[]): string {
  const refs = chunks.slice(0, 3).map((c) => `• (Bloc ${c.blockIndex ?? "—"}) ${c.text.slice(0, 220)}`).join("\n");
  return `D'après le parcours, voici les passages les plus pertinents :\n${refs}\n\n(Réponse extractive — un tuteur IA complet est disponible lorsque la génération est activée.)`;
}

const OUT_OF_SCOPE = "Je n'ai pas trouvé d'élément dans ce parcours pour répondre précisément à cette question. Reformulez, ou consultez le bloc concerné — je ne réponds qu'à partir du contenu du cours.";

export async function answer(question: string, chunks: RetrievedChunk[], history: Turn[], momentAncrage: string | null): Promise<TutorAnswer> {
  if (!isGrounded(question, chunks)) {
    return { text: OUT_OF_SCOPE, grounded: false, aiGenerated: false, provider: "guardrail", citations: [] };
  }
  const citations = citationsOf(chunks);
  if (!aiAvailable()) {
    return { text: extractiveAnswer(chunks), grounded: true, aiGenerated: false, provider: "extractive", citations };
  }
  try {
    const text = await callClaudeText(buildTutorRequest(question, chunks, history, momentAncrage));
    return { text, grounded: true, aiGenerated: true, provider: env.AI_MODEL, citations };
  } catch {
    return { text: extractiveAnswer(chunks), grounded: true, aiGenerated: false, provider: "extractive (ai-fallback)", citations };
  }
}
