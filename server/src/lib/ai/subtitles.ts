/**
 * ai/subtitles.ts — génération de sous-titres (transcription + traduction).
 *
 * Principe « une fois pour toutes » : ces fonctions ne sont appelées qu'à la
 * génération (bouton admin). Le résultat est stocké comme piste CAPTIONS du
 * média et servi ensuite en fichier statique — plus aucune IA à la lecture.
 *
 * Fournisseurs :
 *  - transcription : OpenAI Whisper (OPENAI_API_KEY, rapide) ou, à défaut,
 *    whisper.cpp en local (WHISPER_CPP_BIN + WHISPER_CPP_MODEL — gratuit et
 *    sans compte, mais plusieurs minutes par vidéo sur un petit VPS : la
 *    génération passe alors en arrière-plan, voir media.service) ;
 *  - traduction FR → EN : Claude si configuré, sinon OpenAI ; sans aucun
 *    fournisseur, la traduction est refusée (jamais de faux anglais).
 * Les transformations de texte (SRT → VTT, découpage/réassemblage des cues)
 * sont pures et testées unitairement.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText } from "./client.js";
import { ffmpegAvailable } from "../media/transcode.js";

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

/** Whisper local (whisper.cpp) configuré et réellement présent sur le disque ? */
export function localWhisperAvailable(): boolean {
  return Boolean(env.WHISPER_CPP_BIN && env.WHISPER_CPP_MODEL
    && existsSync(env.WHISPER_CPP_BIN) && existsSync(env.WHISPER_CPP_MODEL));
}
export function transcriptionAvailable(): boolean {
  return Boolean(env.OPENAI_API_KEY) || localWhisperAvailable();
}
/** Vrai quand la transcription passera par whisper.cpp local (lent → la
 *  génération doit être lancée en arrière-plan, pas dans la requête HTTP). */
export function transcriptionIsLocal(): boolean {
  return !env.OPENAI_API_KEY && localWhisperAvailable();
}
export function translationAvailable(): boolean {
  return aiAvailable() || Boolean(env.OPENAI_API_KEY);
}

/** spawn asynchrone (la transcription locale dure des minutes — ne jamais
 *  bloquer l'event loop avec spawnSync ici). */
function runCommand(cmd: string, args: string[], timeoutMs: number): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"], timeout: timeoutMs });
    let stderr = "";
    child.stderr.on("data", (d) => { if (stderr.length < 8192) stderr += String(d); });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stderr }));
  });
}

/** Transcrit via whisper.cpp local : conversion WAV 16 kHz mono (si ffmpeg est
 *  là — l'image de production l'embarque), puis `whisper-cli … -ovtt`. */
async function transcribeLocallyToVtt(media: Buffer, filename: string, language: "fr" | "en"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "kd-whisper-"));
  try {
    let input = join(dir, `input${extname(filename) || ".bin"}`);
    await writeFile(input, media);
    if (ffmpegAvailable()) {
      const wav = join(dir, "input.wav");
      const conv = await runCommand("ffmpeg", ["-y", "-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], 5 * 60_000);
      if (conv.status !== 0) {
        throw new SubtitleError(502, "transcription_failed", `Conversion audio (ffmpeg) échouée : ${conv.stderr.trim().split("\n").pop() ?? `statut ${conv.status}`}`);
      }
      input = wav;
    }
    const threads = Math.max(1, Math.min(4, availableParallelism()));
    const out = join(dir, "out");
    const run = await runCommand(env.WHISPER_CPP_BIN!, [
      "-m", env.WHISPER_CPP_MODEL!, "-l", language, "-t", String(threads),
      "-ovtt", "-of", out, "-np", input,
    ], 45 * 60_000).catch((e: Error) => {
      throw new SubtitleError(502, "transcription_failed", `Whisper local introuvable ou illançable (${e.message})`);
    });
    if (run.status !== 0) {
      throw new SubtitleError(502, "transcription_failed", `Whisper local a échoué (statut ${run.status}) : ${run.stderr.trim().split("\n").pop() ?? ""}`);
    }
    const vtt = (await readFile(`${out}.vtt`, "utf8").catch(() => "")).trim();
    if (!vtt.includes("-->")) throw new SubtitleError(502, "transcription_empty", "La transcription locale ne contient aucune cue");
    return vtt.startsWith("WEBVTT") ? vtt + "\n" : `WEBVTT\n\n${vtt}\n`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Transcrit un fichier audio/vidéo en WebVTT (langue imposée) — OpenAI Whisper
 *  si une clé est configurée (rapide), sinon whisper.cpp local. */
export async function transcribeToVtt(media: Buffer, filename: string, language: "fr" | "en"): Promise<string> {
  if (!transcriptionAvailable()) {
    throw new SubtitleError(409, "transcription_unavailable",
      "Transcription indisponible : configurez OPENAI_API_KEY (OpenAI Whisper) ou le Whisper local (WHISPER_CPP_BIN + WHISPER_CPP_MODEL). L'import manuel de fichiers .vtt/.srt reste possible.");
  }
  if (transcriptionIsLocal()) return transcribeLocallyToVtt(media, filename, language);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(media)]), filename);
  form.append("model", "whisper-1");
  form.append("language", language);
  form.append("response_format", "vtt");
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form,
    });
  } catch (e) {
    throw new SubtitleError(502, "transcription_unreachable",
      `Impossible de joindre api.openai.com depuis le serveur (${e instanceof Error ? e.message : "réseau"}) — vérifiez la sortie réseau du conteneur.`);
  }
  if (res.status === 401) {
    throw new SubtitleError(502, "transcription_auth",
      "OpenAI a refusé la clé (401) : la valeur d'OPENAI_API_KEY sur le serveur est invalide (clé d'exemple non remplacée, clé révoquée ou tronquée). Remplacez-la dans deploy/.env puis reconstruisez l'API.");
  }
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
      model: env.AI_MODEL, max_tokens: 16000,
      system: [{ type: "text", text: TRANSLATE_BRIEF }],
      messages: [{ role: "user", content: joined }],
    });
  } else if (env.OPENAI_API_KEY) {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: TRANSLATE_BRIEF }, { role: "user", content: joined }] }),
      });
    } catch (e) {
      throw new SubtitleError(502, "translation_unreachable", `Traduction : api.openai.com injoignable (${e instanceof Error ? e.message : "réseau"})`);
    }
    if (res.status === 401) throw new SubtitleError(502, "translation_auth", "Traduction : OpenAI a refusé la clé (401) — OPENAI_API_KEY invalide sur le serveur");
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
