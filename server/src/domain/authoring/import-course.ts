/**
 * import-course.ts — parseur DÉTERMINISTE d'un document de parcours K-HCBLM
 * complet (gabarit « conforme v2.x » : blocs en majuscules, MICRO-SESSION X.Y,
 * Vidéo N, Question N + options A–D + « Bonne réponse : X — feedback »,
 * activités longues, tableaux de journal/grilles/champs).
 *
 * Entrée : les éléments STRUCTURÉS du .docx (paragraphes + tableaux, dans
 * l'ordre — lib/docx.docxToDocElements). Sortie : un document de contenu
 * complet bâti sur le squelette conforme, un rapport de couverture (part du
 * document répartie automatiquement), et les restes par bloc à placer à la
 * main. Aucune IA, aucun I/O : tout est rejouable et testable.
 *
 * Garantie de barrière : les jetons {{moment_ancrage}} exigés par la
 * validation (un exercice des Blocs 1-3, une entrée de journal, le sujet du
 * Bloc 4) sont réinjectés s'ils manquent au document — chaque réinjection est
 * signalée dans coverage.fixups pour relecture.
 */
import type { DocElement } from "../../lib/docx.js";
import { MOMENT_ANCRAGE_TOKEN, type CourseContent as CourseContentT } from "../content-model.js";
import { referentielDomain } from "../referentiel.js";

const T = MOMENT_ANCRAGE_TOKEN;

export type ImportCoverage = {
  totalElements: number;
  mappedElements: number;
  mappedPct: number;
  /** Réinjections automatiques (jetons PAM…) à relire dans l'éditeur. */
  fixups: string[];
  perBlock: Record<number, { mapped: number; total: number }>;
};

export type ImportedCourse = {
  content: CourseContentT;
  /** Restes par bloc (texte non réparti), à dispatcher dans l'éditeur. */
  blockNotes: Record<number, string>;
  coverage: ImportCoverage;
};

// --- reconnaissance des marqueurs (conventions du gabarit) -------------------

const BLOCK_RE = /^BLOC\s*([0-4])\s*[—–:-]\s*(.+)$/;
const MS_RE = /^MICRO-SESSION\s+(\d+)\.(\d+)\s*[—–:-]\s*(.+)$/i;
const LONG_RE = /^ACTIVITÉ\s+EXPÉRIENTIELLE\s+LONGUE\s*[—–:-]\s*(.+)$/i;
const VIDEO_RE = /^(?:VIDÉO\s+DÉCLENCHEUR\s*[—–:-]\s*)?Vid[ée]o\s+(\d+)\s*[—–:\-.]?\s*(.+?)\s+(\d+)\s*min\.?\s*$/i;
const KEY_RE = /^MESSAGE\s+CL[ÉE]S?\s*[:—–-]\s*(.+)$/i;
const EX_RE = /^EXEMPLE\s+AFRICAIN\s*[:—–-]\s*(.+)$/i;
const ERR_RE = /^ERREUR\s+À\s+ÉVITER\s*[:—–-]\s*(.+)$/i;
const SCRIPT_RE = /^Script\s+intégral/i;
const QUESTION_RE = /^Question\s+(\d+(?:\.\d+)?)\s*(?:[—–-]\s*(.+))?$/i;
const DECISION_RE = /^Décision\s+D?(\d+)\s*$/i;
const OPTION_RE = /^([A-D])[.)]\s+(.+)$/;
const ANSWER_RE = /^Bonne\s+réponse\s*:\s*([A-D])\s*(?:[—–-]\s*(.+))?$/i;
const PROFILING_RE = /aucune\s+réponse\s+n'est\s+incorrecte/i;
const SCENARIO_RE = /^Scénario\s+(\d+)\s*[—–-]\s*(.+)$/i;
const ETAPE_RE = /^ÉTAPE\s+(\d+)\s*[—–-]\s*(.+)$/i;
const ETAPE_LOW_RE = /^Étape\s+(\d+)\s*[—–-]\s*(.+)$/;
const HABIT_RE = /^HABITUDE\s+(\d+)\s*[—–-]\s*(.+)$/i;
const EXO_RE = /^MICRO-EXERCICE\s+\d+\s*[—–-]\s*(.+)$/i;
const GRID_RE = /^GRILLE\s+D'AUTO-ÉVALUATION/i;
const RECALL_RE = /^Carte\s+de\s+rappel/i;
const FIELD_RE = /^(.{3,}?)\s*:\s*_{4,}/;
const BLANK_RE = /^_{6,}\s*$/;
const NUM_BLANK_RE = /^(\d+)[.)]\s*_{4,}/;
const CASE_RE = /^Cas\s*:\s*(.+)$/i;
const SUJET_RE = /^Sujet\s+du\s+mini-projet/i;
const FIN_BLOC_RE = /^FIN\s+DU\s+BLOC\s+\d/i;
const SECTION_RE = /SECTION\s+(\d)\s*:\s*(.+)$/i;
const RESULT_RE = /^(?:→\s*)?Résultat\s+(?:LMS|de l'activité)/i;
const LEVEL_RE = /\bNIVEAU\s+([123])\b/i;
const OBJECTIVE_RE = /«\s*(À la fin de ce parcours[^»]+)»/i;
const QUIZ_TRIGGER_RE = /^Quiz\s+de\s+déclencheur/i;
const MA_RE = /^MOMENT\s+D'ANCRAGE\b/i;
// NB : pas de \b final — après une lettre accentuée (non-ASCII), \b ne matche pas.
const PROFILE_HDR_RE = /^PROFIL\s+AUTO-DÉCLARÉ/i;
const PROFILE_ITEM_RE = /^([A-D])\s*[—–-]\s*([^:]+):\s*(.+)$/;
const COMP_CODE_RE = /^([A-Z]\d)\.C(\d)$/;
const SEUIL_PCT_RE = /Seuil\s+de\s+réussite\s*:\s*(\d+)\s*%/i;
const DAY_RE = /J\s*\+\s*(\d+)/;

/** Durée « (~2H20 · …) » ou « (~15 MIN · …) » → libellé lisible. */
function durationOf(text: string): string | undefined {
  const m = /\(\s*~?\s*(\d+)\s*[Hh]\s*(\d{2})?/.exec(text);
  if (m) return `${m[1]} h${m[2] ? ` ${m[2]}` : ""}`;
  const mm = /\(\s*~?\s*(\d+)\s*MIN/i.exec(text);
  return mm ? `${mm[1]} min` : undefined;
}

/** « TITRE EN MAJUSCULES   (~15 MIN · …) » → titre sans la parenthèse, casse de phrase. */
function titleOf(raw: string): string {
  const noParen = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (noParen !== noParen.toUpperCase()) return noParen;
  const lower = noParen.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const unquote = (s: string) => s.replace(/^[«"'\s]+|[»"'\s]+$/g, "").trim();
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

const isP = (e: DocElement): e is Extract<DocElement, { kind: "p" }> => e.kind === "p";

/** Marqueur « fort » : ouvre une nouvelle unité — ferme le script/l'exercice courant. */
function isUnitMarker(t: string): boolean {
  return MS_RE.test(t) || LONG_RE.test(t) || BLOCK_RE.test(t) || FIN_BLOC_RE.test(t) || RECALL_RE.test(t);
}

// --- questions ---------------------------------------------------------------

type ParsedQuestion = {
  num: string;
  text: string;
  options: { key: "A" | "B" | "C" | "D"; label: string }[];
  correctKey?: "A" | "B" | "C" | "D";
  feedback?: string;
  open: boolean;
  profiling: boolean;
  savedForProject: boolean;
};

/** Consomme les éléments d'un quiz : Question N (ou Décision DN) → texte →
 *  options A-D → « Bonne réponse : X — … » | marqueur de profilage | réponse
 *  ouverte. Retourne les questions et les indices d'éléments consommés. */
function parseQuestions(els: DocElement[], consumed: Set<number>): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  let q: ParsedQuestion | null = null;
  let inText = false;
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) continue;
    const t = e.text.trim();
    const qm = QUESTION_RE.exec(t) ?? DECISION_RE.exec(t);
    if (qm) {
      const suffix = QUESTION_RE.test(t) ? (QUESTION_RE.exec(t)?.[2] ?? "") : "";
      q = {
        num: qm[1]!, text: "", options: [], open: /réflexion\s+ouverte/i.test(suffix),
        profiling: false, savedForProject: false,
      };
      out.push(q); inText = true; consumed.add(i);
      continue;
    }
    if (!q) continue;
    let m: RegExpExecArray | null;
    if ((m = OPTION_RE.exec(t))) {
      q.options.push({ key: m[1] as "A", label: m[2]!.trim() }); inText = false; consumed.add(i); continue;
    }
    if ((m = ANSWER_RE.exec(t))) {
      q.correctKey = m[1] as "A"; q.feedback = m[2]?.trim(); consumed.add(i); q = null; continue;
    }
    if (PROFILING_RE.test(t)) { q.profiling = true; consumed.add(i); q = null; continue; }
    if (BLANK_RE.test(t) || /^Votre réponse\s*:/.test(t)) { consumed.add(i); continue; }
    if (inText) {
      if (/sauvegardée.*(projet|bloc\s*4)/i.test(t) || /sauvegardée\s+et\s+réutilisée/i.test(t)) q.savedForProject = true;
      q.text = q.text ? `${q.text}\n${t}` : t;
      consumed.add(i);
    }
  }
  return out;
}

const scored = (qs: ParsedQuestion[], prefix: string) =>
  qs.filter((q) => !q.open && q.options.length >= 2).map((q, i) => ({
    id: `${prefix}${i + 1}`,
    scenarioText: q.text || `Question ${q.num}`,
    options: q.options,
    ...(q.profiling ? { profiling: true } : { correctKey: q.correctKey ?? "A" }),
    feedbackText: q.feedback ?? "Feedback affiché par la plateforme.",
  }));

// --- micro-session (vidéo + micro-exercice) ----------------------------------

type SessionParse = {
  id: string; title: string; durationEstimate: string;
  video?: { title: string; durationSec: number; keyMessage: string; africanExample: string; errorToAvoid: string; scriptText: string };
  exercise?: { type: "guidedForm" | "written"; prompt: string; feedbackText: string; fields?: { label: string; placeholder: string; prefillFromMomentAncrage: boolean }[]; minChars?: number };
};

/** Table de champs « Élément | Ma réponse | … » → intitulés (col. 1, hors en-tête). */
function fieldsOfTable(rows: string[][]): string[] {
  const body = rows.filter((r) => r.slice(1).some((c) => /_{3,}/.test(c) || c.trim() === ""));
  const src = body.length ? body : rows.slice(1);
  return src.map((r) => r[0]?.replace(/\s*:\s*$/, "").trim() ?? "").filter((l) => l.length >= 3);
}

function parseSessionUnit(els: DocElement[], id: string, title: string, duration: string, consumed: Set<number>): SessionParse {
  const s: SessionParse = { id, title, durationEstimate: duration };
  const script: string[] = [];
  let inScript = false;
  let exo: { title: string; prompt: string[]; fields: string[]; feedback?: string } | null = null;
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      if (exo && e.kind === "table") { exo.fields.push(...fieldsOfTable(e.rows)); consumed.add(i); }
      continue;
    }
    const t = e.text.trim();
    let m: RegExpExecArray | null;
    if ((m = VIDEO_RE.exec(t))) {
      s.video = { title: unquote(m[2]!), durationSec: Number(m[3]) * 60, keyMessage: "", africanExample: "", errorToAvoid: "", scriptText: "" };
      if (!s.title || /VIDÉO/i.test(s.title)) s.title = unquote(m[2]!);
      inScript = false; consumed.add(i); continue;
    }
    if (s.video && (m = KEY_RE.exec(t))) { s.video.keyMessage = m[1]!.trim(); consumed.add(i); continue; }
    if (s.video && (m = EX_RE.exec(t))) { s.video.africanExample = m[1]!.trim(); consumed.add(i); continue; }
    if (s.video && (m = ERR_RE.exec(t))) { s.video.errorToAvoid = m[1]!.trim(); consumed.add(i); continue; }
    if (s.video && SCRIPT_RE.test(t)) { inScript = true; consumed.add(i); continue; }
    if ((m = EXO_RE.exec(t))) {
      inScript = false;
      exo = { title: unquote(m[1]!.replace(/\s+\d+\s*min.*$/i, "")), prompt: [], fields: [] };
      consumed.add(i); continue;
    }
    if (exo && RESULT_RE.test(t)) { exo.feedback = t.replace(/^→\s*/, ""); consumed.add(i); continue; }
    if (exo && (m = FIELD_RE.exec(t))) { exo.fields.push(m[1]!.trim()); consumed.add(i); continue; }
    if (exo && !exo.fields.length && !RESULT_RE.test(t)) { exo.prompt.push(t); consumed.add(i); continue; }
    if (inScript) { script.push(t); consumed.add(i); continue; }
  }
  if (s.video && script.length) s.video.scriptText = script.join("\n\n");
  if (exo) {
    s.exercise = exo.fields.length
      ? { type: "guidedForm", prompt: [exo.title, ...exo.prompt].filter(Boolean).join(" — "), feedbackText: exo.feedback ?? "Feedback affiché par la plateforme.", fields: exo.fields.map((label) => ({ label, placeholder: "", prefillFromMomentAncrage: false })) }
      : { type: "written", prompt: [exo.title, ...exo.prompt].filter(Boolean).join(" — "), feedbackText: exo.feedback ?? "Feedback affiché par la plateforme.", minChars: 120 };
  }
  return s;
}

const summaryOf = (s: SessionParse): string[] => {
  const pts = [s.video?.keyMessage, s.video?.africanExample, s.video?.errorToAvoid]
    .filter((x): x is string => Boolean(x?.trim())).map((x) => cut(x, 180));
  while (pts.length < 3) pts.push(`Point clé ${pts.length + 1} (à compléter)`);
  return pts.slice(0, 3);
};

// --- découpage en unités ------------------------------------------------------

type Unit = { header: string; headerIdx: number; els: DocElement[]; index: number[]; kind: "session" | "long" | "stray" };

function splitUnits(els: DocElement[]): Unit[] {
  const units: Unit[] = [{ header: "", headerIdx: -1, els: [], index: [], kind: "stray" }];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    const t = isP(e) ? e.text.trim() : "";
    if (t && (MS_RE.test(t) || LONG_RE.test(t))) {
      units.push({ header: t, headerIdx: i, els: [], index: [], kind: MS_RE.test(t) ? "session" : "long" });
      continue;
    }
    const u = units[units.length - 1]!;
    u.els.push(e); u.index.push(i);
  }
  return units;
}

// --- import complet -----------------------------------------------------------

export function importCourseFromElements(elements: DocElement[], scaffold: CourseContentT): ImportedCourse {
  const content: CourseContentT = structuredClone(scaffold);
  const fixups: string[] = [];
  const notes: Record<number, string[]> = {};

  // 1) Découpage intro / blocs.
  const spans: { block: number; els: DocElement[] }[] = [{ block: -1, els: [] }];
  for (const e of elements) {
    const t = isP(e) ? e.text.trim() : "";
    const bm = t ? BLOCK_RE.exec(t) : null;
    if (bm && t === t.toUpperCase()) {
      spans.push({ block: Number(bm[1]), els: [e] });
      continue;
    }
    spans[spans.length - 1]!.els.push(e);
  }

  const perBlock: Record<number, { mapped: number; total: number }> = {};
  let mappedTotal = 0;

  // 2) Métadonnées globales (titre, niveau, objectif, compétences, seuils) —
  //    cherchées dans tout le document.
  const allP = elements.filter(isP).map((e) => e.text.trim());
  const levelLine = allP.find((t) => LEVEL_RE.test(t) && t === t.toUpperCase());
  const level = levelLine ? (Number(LEVEL_RE.exec(levelLine)![1]) as 1 | 2 | 3) : content.level;
  content.level = level;
  const introP = spans[0]!.els.filter(isP).map((e) => e.text.trim());
  const titleLine = introP.find((t) => t === t.toUpperCase() && t.length > 25 && !LEVEL_RE.test(t) && !/KOMPETENCES|CONFORME|RÉFÉRENCES|MISE EN/i.test(t));
  if (titleLine) content.title = titleOf(titleLine);
  for (const e of elements) {
    const txt = isP(e) ? e.text : e.rows.flat().join("\n");
    const om = OBJECTIVE_RE.exec(txt);
    if (om) { content.objective = om[1]!.trim(); break; }
  }
  // Compétences : première table dont la 1re colonne porte des codes Dx.Cy.
  for (const e of elements) {
    if (e.kind !== "table") continue;
    const rows = e.rows.filter((r) => COMP_CODE_RE.test(r[0]?.trim() ?? ""));
    if (rows.length >= 2) {
      content.competencies = rows.map((r) => ({ code: r[0]!.trim(), label: (r[1] ?? "").trim().replace(/\s*\(.*\)$/, "") || r[0]!.trim() }));
      const code = rows[0]![0]!.trim().split(".")[0]!;
      const dom = referentielDomain(code);
      content.domain = { code, label: dom?.label ?? content.domain.label };
      break;
    }
  }

  // 3) Parcours bloc par bloc.
  for (const span of spans) {
    const b = span.block;
    const consumed = new Set<number>();
    const els = span.els;
    if (b === -1) {
      // Intro : tout ce qui n'est pas métadonnée part en notes du Bloc 0.
      const leftover = els.filter((e, i) => !consumed.has(i) && isP(e)).map((e) => (e as { text: string }).text);
      if (leftover.length) (notes[0] ??= []).push(...leftover.slice(0, 40));
      perBlock[-1] = { mapped: 0, total: els.length };
      continue;
    }
    const block = content.blocks.find((x) => x.index === b);
    if (!block) continue;

    // En-tête du bloc (1er élément du span).
    const hdr = isP(els[0]!) ? (els[0] as { text: string }).text : "";
    const bm = BLOCK_RE.exec(hdr);
    if (bm) {
      block.title = titleOf(bm[2]!);
      const d = durationOf(hdr);
      if (d) block.durationEstimate = `~${d}`;
      consumed.add(0);
    }

    const units = splitUnits(els.slice(1));
    // Réindexation : les unités référencent els à partir de 1.
    const mark = (u: Unit, local: Set<number>) => { for (const li of local) consumed.add(u.index[li]! + 1); };

    const sessions: SessionParse[] = [];

    for (const u of units) {
      const header = u.header;
      const local = new Set<number>();
      const msm = MS_RE.exec(header);
      const lm = LONG_RE.exec(header);
      const uTitle = msm ? titleOf(msm[3]!) : lm ? titleOf(lm[1]!) : "";
      const uDur = durationOf(header) ?? "20 min";
      if (u.headerIdx >= 0) consumed.add(u.headerIdx + 1);
      // Éléments transverses présents dans n'importe quelle unité : carte de
      // rappel, fin de bloc, sujet du mini-projet, seuil de certification.
      const strayDone = () => { parseStray(u.els, b, block as never, content, local, notes); mark(u, local); };

      // Routage par mots-clés du titre d'unité.
      const H = header.toUpperCase();
      if (b === 0 && (msm || u.kind === "stray")) {
        parseOnboarding(u.els, block as never, local, fixups);
        strayDone();
        continue;
      }
      if (/QUIZ DIAGNOSTIQUE/.test(H)) {
        const qs = parseQuestions(u.els, local);
        const sq = scored(qs, "d");
        if (sq.length && block.type === "COMPREHENSION") {
          block.payload.diagnosticQuiz.questions = sq as never;
          block.payload.diagnosticQuiz.title = uTitle;
          block.payload.diagnosticQuiz.durationEstimate = uDur;
        }
        strayDone();
        continue;
      }
      if (/QUIZ INTERBLOC/.test(H)) {
        const qs = parseQuestions(u.els, local);
        const sq = scored(qs, "i");
        if (sq.length && block.type === "PRACTICE") {
          block.payload.interBlockQuiz = { title: uTitle, durationEstimate: uDur, scored: false, questions: sq as never };
        }
        strayDone();
        continue;
      }
      if (/QUIZ FINAL/.test(H)) {
        const local2 = new Set<number>();
        let pass: number | undefined;
        u.els.forEach((e, i2) => {
          const txt = isP(e) ? e.text : e.rows.flat().join(" ");
          const m2 = SEUIL_PCT_RE.exec(txt);
          if (m2) { pass = Number(m2[1]); local2.add(i2); }
        });
        const qs = parseQuestions(u.els, local2);
        const sq = scored(qs, "f");
        if (sq.length && block.type === "ANCHORING") {
          block.payload.finalQuiz.questions = sq as never;
          block.payload.finalQuiz.title = uTitle;
          block.payload.finalQuiz.durationEstimate = uDur;
          if (pass) { block.payload.finalQuiz.passThreshold = pass; content.passThreshold = pass; }
        }
        for (const li of local2) local.add(li);
        strayDone();
        continue;
      }
      if (/ÉTUDE DE CAS|CAS TRANSVERSAL/.test(H)) {
        const cs = parseCase(u.els, uTitle, uDur, local);
        if (block.type === "COMPREHENSION") block.payload.caseStudy = cs as never;
        else if (block.type === "ANCHORING") block.payload.transversalCase = cs as never;
        else (notes[b] ??= []).push(`[Étude de cas non rattachée au bloc ${b}]`);
        strayDone();
        continue;
      }
      if (/MISES EN SITUATION/.test(H) && block.type === "PRACTICE") {
        const sc = parseScenarios(u.els, local);
        if (sc.length) {
          block.payload.guidedScenarios = sc as never;
          block.payload.guidedScenariosTitle = uTitle;
          block.payload.guidedScenariosDuration = uDur;
        }
        strayDone();
        continue;
      }
      if (/APPLICATION TERRAIN/.test(H) && block.type === "PRACTICE") {
        parseFieldApplication(u.els, block.payload, uTitle, uDur, local);
        strayDone();
        continue;
      }
      if (/PLAN D'ACTION/.test(H) && block.type === "ANCHORING") {
        parseActionPlan(u.els, block.payload, uTitle, uDur, local);
        strayDone();
        continue;
      }
      if (b === 4 && (SECTION_RE.test(header) || /JOURNAL/.test(H))) {
        parseBloc4Unit(u.els, header, block as never, uDur, local);
        strayDone();
        continue;
      }
      if (msm && Number(msm[2]) > 0) {
        // Micro-session « vidéo + exercice » (une grille d'auto-évaluation
        // embarquée est extraite au passage).
        const grid = extractSelfAssessment(u.els, local);
        if (grid && block.type === "ANCHORING") block.payload.selfAssessment = grid as never;
        const sp = parseSessionUnit(u.els, `${msm[1]}.${msm[2]}`, uTitle, uDur, local);
        if (sp.video) sessions.push(sp);
        strayDone();
        continue;
      }
      // Unité inconnue (ou éléments hors unité) : cartes de rappel, fins de
      // bloc, sujet du mini-projet… traités élément par élément.
      parseStray(u.els, b, block as never, content, local, notes);
      mark(u, local);
    }

    if (sessions.length && "microSessions" in block.payload) {
      (block.payload as { microSessions: unknown[] }).microSessions = sessions.map((s, i) => ({
        id: s.id, title: s.title, durationEstimate: s.durationEstimate,
        summaryPoints: summaryOf(s),
        video: { title: s.video!.title, url: "", durationSec: s.video!.durationSec, keyMessage: s.video!.keyMessage, africanExample: s.video!.africanExample, errorToAvoid: s.video!.errorToAvoid, scriptText: s.video!.scriptText },
        ...(s.exercise ? { exercise: s.exercise } : {}),
      }));
    }

    // Restes du bloc → notes.
    els.forEach((e, i) => {
      if (consumed.has(i)) return;
      const txt = isP(e) ? e.text : e.rows.map((r) => r.join(" | ")).join("\n");
      if (txt.trim()) (notes[b] ??= []).push(txt);
    });
    perBlock[b] = { mapped: consumed.size, total: els.length };
    mappedTotal += consumed.size;
  }

  // 4) Garanties de barrière : jetons PAM aux points de contact obligatoires.
  const allSessions = content.blocks.flatMap((bl) => ("microSessions" in bl.payload ? bl.payload.microSessions : []));
  if (!allSessions.some((s) => s.exercise?.prompt.includes(T))) {
    const first = content.blocks.find((bl) => bl.type === "COMPREHENSION");
    const s0 = first && "microSessions" in first.payload ? first.payload.microSessions[0] : undefined;
    if (s0) {
      if (s0.exercise) s0.exercise.prompt += `\n\nVotre point de départ (Moment d'Ancrage) : « ${T} »`;
      else s0.exercise = { type: "written", prompt: `À partir de votre Moment d'Ancrage — « ${T} » —, appliquez le concept de cette session.`, feedbackText: "Feedback affiché par la plateforme.", minChars: 120 } as never;
      fixups.push("Jeton {{moment_ancrage}} réinjecté dans l'exercice de la première micro-session du Bloc 1 (exigence de la barrière).");
    }
  }
  const cert = content.blocks.find((bl) => bl.type === "CERTIFICATION");
  if (cert && cert.type === "CERTIFICATION") {
    if (!cert.payload.journal.entries.some((e) => e.prompt.includes(T))) {
      const last = cert.payload.journal.entries[cert.payload.journal.entries.length - 1];
      if (last) {
        last.prompt += ` Votre point de départ était : « ${T} ».`;
        fixups.push("Jeton {{moment_ancrage}} réinjecté dans la dernière entrée du journal (exigence de la barrière).");
      }
    }
    if (!cert.payload.projectBrief.includes(T)) {
      cert.payload.projectBrief += `\n\nVotre Moment d'Ancrage : « ${T} »`;
      fixups.push("Jeton {{moment_ancrage}} réinjecté dans le sujet du mini-projet (exigence de la barrière).");
    }
    const s1 = cert.payload.sections[0];
    if (s1) s1.prefillFromMomentAncrage = true;
  }
  content.certificate.title = `Certificat de Niveau ${content.level} — ${content.title}`;

  const blockNotes: Record<number, string> = {};
  for (const k of Object.keys(notes)) {
    const txt = notes[Number(k)]!.join("\n").trim();
    if (txt) blockNotes[Number(k)] = txt;
  }
  const total = elements.length;
  return {
    content,
    blockNotes,
    coverage: {
      totalElements: total,
      mappedElements: mappedTotal,
      mappedPct: total ? Math.round((mappedTotal / total) * 100) : 0,
      fixups,
      perBlock,
    },
  };
}

// --- Bloc 0 -------------------------------------------------------------------

function parseOnboarding(
  els: DocElement[],
  block: Extract<CourseContentT["blocks"][number], { type: "ONBOARDING" }>,
  consumed: Set<number>,
  fixups: string[],
) {
  const p = block.payload;
  let mode: "" | "ma" | "profil" | "video" | "script" | "quiz" = "";
  const script: string[] = [];
  const profileQuestionEls: DocElement[] = [];
  const profileQuestionIdx: number[] = [];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      if (mode === "ma" && e.kind === "table" && e.rows[0]?.[0]) {
        p.momentAncrage.promptText = unquote(e.rows[0][0]);
        consumed.add(i); mode = "";
      }
      continue;
    }
    const t = e.text.trim();
    let m: RegExpExecArray | null;
    if (MA_RE.test(t)) { mode = "ma"; consumed.add(i); continue; }
    if (PROFILE_HDR_RE.test(t)) { mode = "profil"; p.profileChoices = []; consumed.add(i); continue; }
    if ((m = VIDEO_RE.exec(t)) && /DÉCLENCHEUR/i.test(t)) {
      p.triggerVideo = { title: unquote(m[2]!), url: "", durationSec: Number(m[3]) * 60, keyMessage: "", africanExample: "", errorToAvoid: "", scriptText: "" };
      p.triggerDuration = `${m[3]} min`;
      mode = "video"; consumed.add(i); continue;
    }
    if (mode === "video" || mode === "script") {
      if ((m = KEY_RE.exec(t))) { p.triggerVideo.keyMessage = m[1]!.trim(); consumed.add(i); continue; }
      if ((m = EX_RE.exec(t))) { p.triggerVideo.africanExample = m[1]!.trim(); consumed.add(i); continue; }
      if ((m = ERR_RE.exec(t))) { p.triggerVideo.errorToAvoid = m[1]!.trim(); consumed.add(i); continue; }
      if (SCRIPT_RE.test(t)) { mode = "script"; consumed.add(i); continue; }
      if (mode === "script" && !QUIZ_TRIGGER_RE.test(t)) { script.push(t); consumed.add(i); continue; }
    }
    if (mode === "profil") {
      if ((m = PROFILE_ITEM_RE.exec(t))) {
        p.profileChoices.push({ key: m[1] as "A", name: m[2]!.trim(), description: m[3]!.trim() });
        consumed.add(i); continue;
      }
      if (p.profileChoices.length >= 2) mode = "";
      else { consumed.add(i); continue; } // la question d'intro du choix de profil
    }
    if (QUIZ_TRIGGER_RE.test(t)) { mode = "quiz"; consumed.add(i); continue; }
    if (mode === "quiz") { profileQuestionEls.push(e); profileQuestionIdx.push(i); }
  }
  if (script.length) p.triggerVideo.scriptText = script.join("\n\n");
  if (profileQuestionEls.length) {
    const local = new Set<number>();
    const qs = parseQuestions(profileQuestionEls, local);
    const tq = qs.filter((q) => q.options.length >= 2).map((q, i2) => ({ id: `t${i2 + 1}`, text: q.text || `Question ${q.num}`, options: q.options }));
    if (tq.length) p.triggerQuiz.questions = tq as never;
    for (const li of local) consumed.add(profileQuestionIdx[li]!);
  }
  if (p.profileChoices.length < 2) {
    p.profileChoices = [
      { key: "A", name: "Profil A", description: "Description à rédiger." },
      { key: "B", name: "Profil B", description: "Description à rédiger." },
    ] as never;
    fixups.push("Profils auto-déclarés non détectés au Bloc 0 — gabarit conservé, à compléter.");
  }
}

// --- étude de cas / cas transversal ------------------------------------------

function parseCase(els: DocElement[], title: string, duration: string, consumed: Set<number>) {
  let subtitle = "";
  let context = "";
  const steps: { title: string; durationEstimate: string; intro: string; questions: unknown[] }[] = [];
  const stepEls: { els: DocElement[]; idx: number[] }[] = [];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      if (!context && e.kind === "table" && e.rows[0]?.[0]) { context = e.rows[0][0].replace(/^Contexte\s*:\s*/i, ""); consumed.add(i); }
      else if (stepEls.length) { stepEls[stepEls.length - 1]!.els.push(e); stepEls[stepEls.length - 1]!.idx.push(i); }
      continue;
    }
    const t = e.text.trim();
    let m: RegExpExecArray | null;
    if ((m = CASE_RE.exec(t))) { subtitle = unquote(m[1]!); consumed.add(i); continue; }
    if ((m = ETAPE_RE.exec(t) ?? ETAPE_LOW_RE.exec(t))) {
      steps.push({ title: m[2]!.replace(/\s+~?\d+\s*min\s*$/i, "").trim(), durationEstimate: /(\d+)\s*min/.exec(t)?.[0] ?? "", intro: "", questions: [] });
      stepEls.push({ els: [], idx: [] });
      consumed.add(i); continue;
    }
    if (stepEls.length) { stepEls[stepEls.length - 1]!.els.push(e); stepEls[stepEls.length - 1]!.idx.push(i); }
  }
  if (!steps.length) { steps.push({ title: "Analyse", durationEstimate: "", intro: "", questions: [] }); stepEls.push({ els: els.filter((_, i) => !consumed.has(i)), idx: els.map((_, i) => i).filter((i) => !consumed.has(i)) }); }
  steps.forEach((st, si) => {
    const local = new Set<number>();
    const qs = parseQuestions(stepEls[si]!.els, local);
    st.questions = qs.map((q, qi) => q.open
      ? { id: `q${si + 1}.${qi + 1}`, kind: "open", prompt: q.text, allValid: false, feedback: "", savedForProject: q.savedForProject, minChars: 100 }
      : { id: `q${si + 1}.${qi + 1}`, kind: "mcq", prompt: q.text, options: q.options, correctKey: q.correctKey ?? "A", allValid: false, feedback: q.feedback ?? "" });
    for (const li of local) consumed.add(stepEls[si]!.idx[li]!);
  });
  return { title: title || "Étude de cas", subtitle, context, durationEstimate: duration, steps: [], structuredSteps: steps, summary: [] };
}

// --- scénarios guidés ---------------------------------------------------------

function parseScenarios(els: DocElement[], consumed: Set<number>) {
  const out: { title: string; contextAfricain: string; steps: { question: string; options: unknown[]; correctKey: string; feedback: string }[] }[] = [];
  const spans: { els: DocElement[]; idx: number[] }[] = [];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    const t = isP(e) ? e.text.trim() : "";
    const m = t ? SCENARIO_RE.exec(t) : null;
    if (m) {
      out.push({ title: m[2]!.replace(/\s+~?\d+\s*min\s*$/i, "").trim(), contextAfricain: "", steps: [] });
      spans.push({ els: [], idx: [] });
      consumed.add(i); continue;
    }
    if (spans.length) { spans[spans.length - 1]!.els.push(e); spans[spans.length - 1]!.idx.push(i); }
  }
  out.forEach((sc, si) => {
    const span = spans[si]!;
    span.els.forEach((e, i2) => {
      if (e.kind === "table" && !sc.contextAfricain && e.rows[0]?.[0]) {
        sc.contextAfricain = e.rows[0][0].replace(/^Contexte\s*:\s*/i, "");
        consumed.add(span.idx[i2]!);
      }
    });
    const local = new Set<number>();
    const qs = parseQuestions(span.els, local);
    sc.steps = qs.filter((q) => q.options.length >= 2).map((q) => ({ question: q.text || `Décision ${q.num}`, options: q.options, correctKey: q.correctKey ?? "A", feedback: q.feedback ?? "Feedback affiché par la plateforme." }));
    for (const li of local) consumed.add(span.idx[li]!);
  });
  return out.filter((s) => s.steps.length);
}

// --- application terrain --------------------------------------------------------

function parseFieldApplication(
  els: DocElement[],
  payload: Extract<CourseContentT["blocks"][number], { type: "PRACTICE" }>["payload"],
  title: string,
  duration: string,
  consumed: Set<number>,
) {
  const fa = payload.fieldApplication;
  fa.title = title; fa.durationEstimate = duration;
  const briefParts: string[] = [];
  const steps: { title: string; intro: string; fields: { label: string; placeholder: string }[] }[] = [];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      if (e.kind === "table") {
        const fields = fieldsOfTable(e.rows);
        if (steps.length && fields.length) { steps[steps.length - 1]!.fields.push(...fields.map((label) => ({ label, placeholder: "" }))); consumed.add(i); }
        else if (!steps.length && e.rows[0]?.[0]) { briefParts.push(e.rows[0][0]); consumed.add(i); }
      }
      continue;
    }
    const t = e.text.trim();
    let m: RegExpExecArray | null;
    if ((m = /^Mission\s*[—–-]\s*(.+)$/.exec(t))) { briefParts.unshift(m[1]!.trim()); consumed.add(i); continue; }
    if ((m = ETAPE_LOW_RE.exec(t) ?? ETAPE_RE.exec(t))) {
      steps.push({ title: m[2]!.replace(/\s*\(?~?\d+\s*min\)?\s*$/i, "").trim(), intro: "", fields: [] });
      consumed.add(i); continue;
    }
    if (steps.length && /^\[.*\]$/.test(t)) { steps[steps.length - 1]!.intro = t.slice(1, -1); consumed.add(i); continue; }
    if (steps.length && (m = FIELD_RE.exec(t))) { steps[steps.length - 1]!.fields.push({ label: m[1]!.trim(), placeholder: "" }); consumed.add(i); continue; }
    if (!steps.length) { briefParts.push(t); consumed.add(i); continue; }
  }
  if (briefParts.length) fa.brief = briefParts.join("\n\n");
  const withFields = steps.filter((s) => s.fields.length);
  if (withFields.length) fa.steps = withFields as never;
}

// --- plan d'action 30 jours ------------------------------------------------------

function parseActionPlan(
  els: DocElement[],
  payload: Extract<CourseContentT["blocks"][number], { type: "ANCHORING" }>["payload"],
  title: string,
  duration: string,
  consumed: Set<number>,
) {
  const plan = payload.actionPlan30d;
  plan.title = title; plan.durationEstimate = duration;
  const habits: { title: string; fields: { label: string; placeholder: string }[] }[] = [];
  let intro = "";
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) continue;
    const t = e.text.trim();
    let m: RegExpExecArray | null;
    if ((m = HABIT_RE.exec(t))) { habits.push({ title: m[1] ? t.replace(/^HABITUDE\s+/i, "Habitude ") : t, fields: [] }); consumed.add(i); continue; }
    if (/^(MES|MON)\s+[A-ZÉ]/.test(t) && t === t.toUpperCase()) { habits.push({ title: titleOf(t), fields: [] }); consumed.add(i); continue; }
    if (habits.length && (m = FIELD_RE.exec(t))) { habits[habits.length - 1]!.fields.push({ label: m[1]!.trim(), placeholder: "" }); consumed.add(i); continue; }
    if (habits.length && (m = NUM_BLANK_RE.exec(t))) { habits[habits.length - 1]!.fields.push({ label: `Priorité ${m[1]}`, placeholder: "" }); consumed.add(i); continue; }
    if (habits.length && BLANK_RE.test(t)) { consumed.add(i); continue; }
    if (habits.length && !habits[habits.length - 1]!.fields.length) {
      // paragraphe d'explication entre l'en-tête et les champs
      habits[habits.length - 1]!.fields.push({ label: cut(t, 160), placeholder: "" });
      consumed.add(i); continue;
    }
    if (!habits.length) { intro = intro ? `${intro} ${t}` : t; consumed.add(i); continue; }
  }
  if (intro) plan.intro = cut(intro, 400);
  const usable = habits.filter((h) => h.fields.length);
  if (usable.length) plan.habits = usable as never;
}

// --- grille d'auto-évaluation -----------------------------------------------------

function extractSelfAssessment(els: DocElement[], consumed: Set<number>) {
  const hi = els.findIndex((e) => isP(e) && GRID_RE.test((e as { text: string }).text.trim()));
  if (hi < 0) return null;
  consumed.add(hi);
  const hdr = (els[hi] as { text: string }).text;
  const ti = els.findIndex((e, i) => i > hi && e.kind === "table");
  if (ti < 0) return null;
  const rows = (els[ti] as { rows: string[][] }).rows;
  consumed.add(ti);
  const header = rows[0] ?? [];
  const scale = header.filter((c) => /^\d\s*[—–-]/.test(c.trim())).map((c) => c.trim());
  const criteria = rows.slice(1).map((r) => r[0]?.trim() ?? "").filter((c) => c.length >= 3);
  if (isP(els[hi + 1]!) && !GRID_RE.test((els[hi + 1] as { text: string }).text)) {
    // consigne sous l'en-tête
    const t = (els[hi + 1] as { text: string }).text.trim();
    if (/évaluez|honnêtement/i.test(t)) consumed.add(hi + 1);
  }
  if (!criteria.length) return null;
  return {
    title: titleOf(hdr.replace(/\s+\d+\s*min.*$/i, "")),
    durationEstimate: /(\d+)\s*min/.exec(hdr)?.[0] ?? "",
    criteria,
    scale: scale.length >= 2 ? scale : ["1 — Jamais", "2 — Parfois", "3 — Souvent", "4 — Toujours"],
  };
}

// --- Bloc 4 -----------------------------------------------------------------------

function parseBloc4Unit(
  els: DocElement[],
  header: string,
  block: Extract<CourseContentT["blocks"][number], { type: "CERTIFICATION" }>,
  duration: string,
  consumed: Set<number>,
) {
  const p = block.payload;
  const sm = SECTION_RE.exec(header);
  const sectionNum = sm ? Number(sm[1]) : /JOURNAL/i.test(header) ? 4 : 0;
  const sectionTitle = sm ? titleOf(sm[2]!) : "Journal de pratique";
  const helpParts: string[] = [];
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      // Table du journal : Entrée | Délai | Durée | Compétence | Question…
      if (e.kind === "table" && e.rows.some((r) => DAY_RE.test(r[1] ?? ""))) {
        const entries = e.rows.filter((r) => DAY_RE.test(r[1] ?? "")).map((r) => ({
          day: Number(DAY_RE.exec(r[1]!)![1]),
          prompt: (r[r.length - 1] ?? "").trim() || "Entrée de journal.",
          minWords: 50,
        }));
        if (entries.length === 6) p.journal.entries = entries as never;
        consumed.add(i);
        continue;
      }
      // Tables de champs des sections → aide (première colonne).
      if (e.kind === "table") {
        const fields = fieldsOfTable(e.rows);
        if (fields.length) { helpParts.push(fields.map((f) => `• ${f}`).join("\n")); consumed.add(i); }
      }
      continue;
    }
    const t = e.text.trim();
    if (BLANK_RE.test(t)) { consumed.add(i); continue; }
    const fm = FIELD_RE.exec(t);
    if (fm) { helpParts.push(`• ${fm[1]!.trim()}`); consumed.add(i); continue; }
    if (NUM_BLANK_RE.test(t)) { consumed.add(i); continue; }
    if (/^Note (de production|pour la direction)/i.test(t)) { continue; } // reste en notes
    if (/^\[.*\]$/.test(t)) { helpParts.unshift(t.slice(1, -1)); consumed.add(i); continue; }
    if (helpParts.length < 6) { helpParts.push(t); consumed.add(i); continue; }
  }
  if (sectionNum >= 1 && sectionNum <= 5) {
    const idx = sectionNum - 1;
    const existing = p.sections[idx];
    p.sections[idx] = {
      title: `Section ${sectionNum} — ${sectionTitle}`,
      helpText: cut(helpParts.join("\n"), 2000),
      durationEstimate: duration,
      prefillFromMomentAncrage: sectionNum === 1 ? true : existing?.prefillFromMomentAncrage ?? false,
    } as never;
  }
}

// --- éléments hors unité (sujet, cartes de rappel, fins de bloc) -------------------

function parseStray(
  els: DocElement[],
  b: number,
  block: CourseContentT["blocks"][number],
  content: CourseContentT,
  consumed: Set<number>,
  notes: Record<number, string[]>,
) {
  let recallPending: string[] | null = null;
  let sujetPending = false;
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (!isP(e)) {
      if (sujetPending && e.kind === "table" && e.rows[0]?.[0] && block.type === "CERTIFICATION") {
        block.payload.projectBrief = unquote(e.rows[0][0]);
        consumed.add(i); sujetPending = false;
      } else if (e.kind === "table") {
        const flat = e.rows.flat().join(" ");
        if (block.type === "CERTIFICATION") {
          // Seuil de certification « 70 points sur 100 » — confirme le seuil de grille.
          const m = /Seuil\s+de\s+certification\s*:\s*(\d+)\s*points/i.exec(flat);
          if (m) { block.payload.rubric.threshold = Number(m[1]); consumed.add(i); }
        }
        if (b === 0 && OBJECTIVE_RE.test(flat)) consumed.add(i); // objectif déjà capté en global
      }
      continue;
    }
    const t = e.text.trim();
    if (RECALL_RE.test(t)) { recallPending = []; consumed.add(i); continue; }
    if (recallPending !== null) {
      if ((e.bullet || recallPending.length === 0) && recallPending.length < 3 && t.length > 10) {
        recallPending.push(t); consumed.add(i);
        if (recallPending.length === 3) { block.recallCard = recallPending as never; recallPending = null; }
        continue;
      }
      recallPending = null;
    }
    if (SUJET_RE.test(t)) { sujetPending = true; consumed.add(i); continue; }
    if (FIN_BLOC_RE.test(t)) { consumed.add(i); continue; }
    if (b === 0 && OBJECTIVE_RE.test(t)) { consumed.add(i); continue; } // déjà capté en global
    void content; void notes;
  }
}
