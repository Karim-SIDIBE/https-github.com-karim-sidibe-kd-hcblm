/**
 * embeddings.ts — text embeddings for semantic search.
 *
 * Pluggable: Voyage AI or OpenAI when a key is set, else a deterministic local
 * embedder (hashed term-frequency, L2-normalized) so search works offline and in
 * tests. Cosine similarity ranks results either way.
 */
import { env } from "../../config/env.js";

const LOCAL_DIM = 256;

export type EmbeddingResult = { vectors: number[][]; model: string; aiGenerated: boolean };

export function embeddingsProvider(): "voyage" | "openai" | "local" {
  if (env.VOYAGE_API_KEY) return "voyage";
  if (env.OPENAI_API_KEY) return "openai";
  return "local";
}

// --- deterministic local embedder -------------------------------------------

const ACCENTS = /[̀-ͯ]/g;
// Common FR/EN stopwords — dropped so generic words don't create spurious
// similarity (important for the offline guardrail + retrieval quality).
const STOPWORDS = new Set(
  ("le la les un une des de du au aux a et ou ni mais donc or car que qui quoi dont ou quel quelle quels quelles " +
   "ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs " +
   "je tu il elle on nous vous ils elles me te se y en " +
   "est es suis sommes etes sont etais etait etre ete sera seront ai as avons avez ont avait " +
   "ne pas plus moins tres bien tout tous toute toutes meme aussi alors comme si sinon " +
   "dans pour par sur sous avec sans vers chez entre apres avant pendant depuis jusque " +
   "comment pourquoi quand ou combien quel cela ceci ca " +
   "the a an of to and or is are was were be been in on for with at by from this that these those it as not").split(/\s+/),
);
export function tokenize(text: string): string[] {
  return (text.normalize("NFD").replace(ACCENTS, "").toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}
function hashToken(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % LOCAL_DIM;
}
function localEmbed(text: string): number[] {
  const v = new Array<number>(LOCAL_DIM).fill(0);
  for (const tok of tokenize(text)) { const idx = hashToken(tok); v[idx] = (v[idx] ?? 0) + 1; }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

// --- remote providers -------------------------------------------------------

async function remoteEmbed(url: string, key: string, model: string, input: string[]): Promise<number[][]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embed(texts: string[]): Promise<EmbeddingResult> {
  if (texts.length === 0) return { vectors: [], model: "none", aiGenerated: false };
  const provider = embeddingsProvider();
  try {
    if (provider === "voyage") {
      const model = env.EMBEDDING_MODEL ?? "voyage-3";
      return { vectors: await remoteEmbed("https://api.voyageai.com/v1/embeddings", env.VOYAGE_API_KEY!, model, texts), model, aiGenerated: true };
    }
    if (provider === "openai") {
      const model = env.EMBEDDING_MODEL ?? "text-embedding-3-small";
      return { vectors: await remoteEmbed("https://api.openai.com/v1/embeddings", env.OPENAI_API_KEY!, model, texts), model, aiGenerated: true };
    }
  } catch {
    // fall through to local on any provider failure
  }
  return { vectors: texts.map(localEmbed), model: "local-tf-256", aiGenerated: false };
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
