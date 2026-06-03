/**
 * ai/client.ts — shared Anthropic client helpers.
 *
 * Centralizes availability + the Messages API call so every AI feature (nudges,
 * formative feedback, rubric suggestions) shares one code path with consistent
 * headers, model selection and prompt caching.
 */
import { env } from "../../config/env.js";

export function aiAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export type ClaudeRequest = {
  model: string;
  max_tokens: number;
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: { role: "user" | "assistant"; content: string }[];
};

/** Call Claude and return the concatenated text. Throws on any failure. */
export async function callClaudeText(request: ClaudeRequest): Promise<string> {
  if (!aiAvailable()) throw new Error("ANTHROPIC_API_KEY non configurée");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content?.map((c) => c.text ?? "").join("").trim();
  if (!text) throw new Error("réponse IA vide");
  return text;
}

/** Extract the first JSON object/array from a model response (defensive). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("aucun JSON dans la réponse");
  return JSON.parse(raw.slice(start));
}
