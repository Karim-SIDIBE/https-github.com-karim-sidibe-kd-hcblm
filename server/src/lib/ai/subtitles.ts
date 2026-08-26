/**
 * ai/subtitles.ts — génération de sous-titres (transcription + traduction).
 *
 * Principe « une fois pour toutes » : ces fonctions ne sont appelées qu'à la
 * génération (bouton admin). Le résultat est stocké comme piste CAPTIONS du
 * média et servi ensuite en fichier statique — plus aucune IA à la lecture.
 *
 * Fournisseurs :
 *  - transcription : OpenAI Whisper (OPENAI_API_KEY requis — pas de repli
 *    déterministe possible pour de la vraie parole) ;
 *  - traduction FR → EN : Claude si configuré, sinon OpenAI ; sans aucun
 *    fournisseur, la traduction est refusée (jamais de faux anglais).
 * Les transformations de texte (SRT → VTT, découpage/réassemblage des cues)
 * sont pures et testées unitairement.
 */
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText } from "./client.js";

export class SubtitleError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

// --- transformations pures ---------------------------------------------------

/** Convertit un fichier SRT en WebVTT (horodatages `,` → `.`, en-tête). */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim();
  return body.startsWith("WEBVTT") ? body + "\n" : `WEBVTT\n\n${body}\n`;
}

export type VttCue = { header: string; text: string };

/** Découpe un VTT en cues { en-tête (horodatage/numéro), texte }. */
export function splitVttCues(vtt: string): { preamble: string; cues: VttCue[] } {
  const norm = vtt.replace(/\r/g, "").trim();
  const blocks = norm.split(/\n\n+/);
  const preamble = blocks[0]?.startsWith("WEBVTT") ? blocks.shift()! : "WEBVTT";
  const cues: VttCue[] = [];
  for (const b of blocks) {
    const lines = b.split("\n");
    // L'en-tête d'une cue = tout jusqu'à la ligne d'horodatage incluse.
    const tsIdx = lines.findIndex((l) => l.includes("-->"));
    if (tsIdx < 0) continue;
    cues.push({ header: lines.slice(0, tsIdx + 1).join("\n"), text: lines.slice(tsIdx + 1).join("\n") });
  }
  return { preamble, cues };
}

/** Réassemble un VTT à partir des cues (horodatages inchangés). */
export function joinVttCues(preamble: string, cues: VttCue[]): string {
  return [preamble, ...cues.map((c) => `${c.header}\n${c.text}`)].join("\n\n") + "\n";
}

/** Traduit les textes des cues via `translate`, horodatages préservés. */
export async function translateCues(vtt: string, translate: (texts: string[]) => Promise<string[]>): Promise<string> {
  const { preamble, cues } = splitVttCues(vtt);
  if (!cues.length) return joinVttCues(preamble, cues);
  const translated = await translate(cues.map((c) => c.text));
  if (translated.length !== cues.length) throw new SubtitleError(502, "translation_mismatch", "La traduction n'a pas renvoyé le bon nombre de segments");
  return joinVttCues(preamble, cues.map((c, i) => ({ header: c.header, text: translated[i]!.trim() || c.text })));
}

// --- fournisseurs ------------------------------------------------------------

export function transcriptionAvailable(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
export function translationAvailable(): boolean {
  return aiAvailable() || Boolean(env.OPENAI_API_KEY);
}

/** Transcrit un fichier audio/vidéo en WebVTT (Whisper, langue imposée). */
export async function transcribeToVtt(media: Buffer, filename: string, language: "fr" | "en"): Promise<string> {
  if (!transcriptionAvailable()) {
    throw new SubtitleError(409, "transcription_unavailable",
      "Transcription indisponible : configurez OPENAI_API_KEY sur le serveur (Whisper). L'import manuel de fichiers .vtt/.srt reste possible.");
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(media)]), filename);
  form.append("model", "whisper-1");
  form.append("language", language);
  form.append("response_format", "vtt");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form,
  });
  if (!res.ok) throw new SubtitleError(502, "transcription_failed", `Whisper a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`);
  const vtt = (await res.text()).trim();
  if (!vtt.includes("-->")) throw new SubtitleError(502, "transcription_empty", "La transcription ne contient aucune cue");
  return vtt.startsWith("WEBVTT") ? vtt + "\n" : `WEBVTT\n\n${vtt}\n`;
}

const TRANSLATE_BRIEF = "Tu traduis des sous-titres de formation professionnelle du français vers l'anglais. Réponds UNIQUEMENT avec les segments traduits, dans le même ordre, séparés par la ligne « --- ». Conserve le ton, la concision (sous-titre lisible) et les nombres/noms propres. Même nombre de segments en sortie qu'en entrée.";

async function providerTranslate(texts: string[]): Promise<string[]> {
  const joined = texts.join("\n---\n");
  let out: string;
  if (aiAvailable()) {
    out = await callClaudeText({
      model: env.AI_MODEL, max_tokens: 4000,
      system: [{ type: "text", text: TRANSLATE_BRIEF }],
      messages: [{ role: "user", content: joined }],
    });
  } else if (env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: TRANSLATE_BRIEF }, { role: "user", content: joined }] }),
    });
    if (!res.ok) throw new SubtitleError(502, "translation_failed", `Traduction : le fournisseur a répondu ${res.status}`);
    out = (await res.json() as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
  } else {
    throw new SubtitleError(409, "translation_unavailable",
      "Traduction indisponible : configurez ANTHROPIC_API_KEY ou OPENAI_API_KEY. La piste française reste générée ; l'anglais peut être importé manuellement.");
  }
  return out.split(/\n?---\n?/).map((s) => s.trim());
}

/** Traduit un VTT français en VTT anglais (par lots, horodatages préservés). */
export async function translateVttFrToEn(vtt: string): Promise<string> {
  const { preamble, cues } = splitVttCues(vtt);
  const out: VttCue[] = [];
  const BATCH = 40; // segments par appel — garde les réponses courtes et fiables
  for (let i = 0; i < cues.length; i += BATCH) {
    const slice = cues.slice(i, i + BATCH);
    const translated = await providerTranslate(slice.map((c) => c.text));
    if (translated.length !== slice.length) throw new SubtitleError(502, "translation_mismatch", "La traduction n'a pas renvoyé le bon nombre de segments");
    slice.forEach((c, j) => out.push({ header: c.header, text: translated[j]!.trim() || c.text }));
  }
  return joinVttCues(preamble, out);
}
