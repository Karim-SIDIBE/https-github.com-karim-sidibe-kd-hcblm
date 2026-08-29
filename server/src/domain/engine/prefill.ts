/**
 * prefill.ts — pré-remplissage des champs de saisie avec les données réelles
 * de l'apprenant. Pur : aucune I/O.
 *
 * Le parcours officiel PROMET ces pré-remplissages (Application terrain du
 * Bloc 2 : « Pré-rempli avec votre Moment d'Ancrage », « Reprenez votre
 * système de temps protégé » ; micro-exercice 1.5 : « Vos éléments sont
 * sauvegardés et pré-remplis dans l'Application terrain ») — ce module les
 * tient. Les valeurs restent des POINTS DE DÉPART éditables : la saisie de
 * l'apprenant prime toujours.
 */

/** Un micro-exercice guidé déjà soumis : sa consigne + les réponses saisies. */
export type SavedForm = {
  prompt: string;
  fields: Record<string, string>;
};

/** Normalisation de comparaison : casse, guillemets/« », espaces multiples. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stripPossessive = (s: string) => s.replace(/^(mon|ma|mes|le|la|les)\s+/, "");

/** Cœur d'un libellé d'Application terrain : le nom de l'outil. Si le libellé
 *  cite l'outil entre « … », c'est lui ; sinon la partie avant le tiret long,
 *  sans le possessif de tête (« Mon système de temps protégé — mise en œuvre
 *  concrète » → « système de temps protégé »). */
export function coreOf(label: string): string {
  const quoted = /«([^»]+)»/.exec(label);
  if (quoted?.[1]?.trim()) return normalizeLabel(quoted[1]);
  const head = label.split("—")[0] ?? label;
  return stripPossessive(normalizeLabel(head));
}

/** Réordonne les réponses selon l'ordre des champs du contenu — le stockage
 *  jsonb ne préserve pas l'ordre des clés, or les lignes jointes doivent
 *  suivre l'ordre de l'exercice d'origine. */
export function orderFields(fields: Record<string, string>, labelOrder: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of labelOrder) if (l in fields) out[l] = fields[l]!;
  for (const [k, v] of Object.entries(fields)) if (!(k in out)) out[k] = v;
  return out;
}

/** Réponses d'un formulaire jointes en lignes « libellé : valeur ». */
function joinForm(form: SavedForm): string {
  return Object.entries(form.fields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k} : ${v.trim()}`)
    .join("\n");
}

/**
 * Valeur de pré-remplissage d'UN champ d'Application terrain :
 *   1. un champ homonyme déjà rempli dans un micro-exercice → sa valeur ;
 *   2. sinon, un micro-exercice dont la consigne évoque le même outil →
 *      toutes ses réponses en « libellé : valeur » ;
 *   3. sinon, rien (champ vide, comme avant).
 * Seuls les champs « … — mise en œuvre … » sont pré-remplis : les champs
 * « adaptation culturelle » et de réflexion restent à l'apprenant.
 */
export function prefillFromForms(label: string, savedForms: SavedForm[]): string | undefined {
  if (!/mise en œuvre|mise en oeuvre/i.test(label)) return undefined;
  const core = coreOf(label);
  if (!core) return undefined;
  // 1. correspondance exacte de libellé de champ (possessifs neutralisés).
  for (const form of savedForms) {
    for (const [k, v] of Object.entries(form.fields)) {
      if (stripPossessive(normalizeLabel(k)) === core && v.trim()) return v.trim();
    }
  }
  // 2. consigne du micro-exercice contenant le cœur du libellé.
  for (const form of savedForms) {
    if (normalizeLabel(form.prompt).includes(core) && Object.keys(form.fields).length) {
      const joined = joinForm(form);
      if (joined) return joined;
    }
  }
  // 2 bis. tolérance singulier/pluriel (« oui différent » vs « oui différents »).
  const words = core.split(" ").filter((w) => w.length > 3);
  if (words.length) {
    for (const form of savedForms) {
      const prompt = normalizeLabel(form.prompt);
      if (words.every((w) => prompt.includes(w.replace(/s$/, "")))) {
        const joined = joinForm(form);
        if (joined) return joined;
      }
    }
  }
  return undefined;
}

export type FieldSpecLike = { label: string; prefill?: string };
export type StepLike = { title: string; intro?: string; fields: FieldSpecLike[] };

// --- réponses « 💾 enregistrée pour le projet » (savedForProject) -------------

/** Une réponse ouverte d'étude de cas marquée savedForProject, avec le type du
 *  bloc d'origine (COMPREHENSION → situation, ANCHORING → solution/rituel). */
export type ProjectSavedAnswer = { prompt: string; answer: string; blockType: string };

type CaseLike = { structuredSteps?: { questions?: { id: string; kind?: string; prompt?: string; savedForProject?: boolean }[] }[] };

/** Extrait d'UN bloc les réponses ouvertes marquées savedForProject déjà
 *  soumises (data.open du CASE_STUDY). Pur : le bloc + la complétion. */
export function savedProjectAnswers(
  blockType: string,
  caseSpec: CaseLike | undefined | null,
  openAnswers: Record<string, string> | undefined | null,
): ProjectSavedAnswer[] {
  if (!caseSpec?.structuredSteps || !openAnswers) return [];
  const out: ProjectSavedAnswer[] = [];
  for (const st of caseSpec.structuredSteps) {
    for (const q of st.questions ?? []) {
      const answer = q.savedForProject && q.kind === "open" ? openAnswers[q.id]?.trim() : undefined;
      if (answer) out.push({ prompt: q.prompt ?? "", answer, blockType });
    }
  }
  return out;
}
/** Une habitude du Plan d'action 30 jours. Les champs « chaîne simple »
 *  (historique) ne peuvent pas porter de prefill — ils sont ignorés. */
export type HabitLike = { title: string; fields: (FieldSpecLike | string)[] };

/**
 * Décore (en place) le Plan d'action 30 jours (micro-session 3.2) — l'intro
 * demande de « repartir des exercices précédents ». Conservateur : seule
 * l'habitude « système de temps protégé » a une source fiable :
 *   - habitude concrète ← la version TESTÉE SUR LE TERRAIN (Application
 *     terrain du Bloc 2, « … — mise en œuvre concrète ») si soumise, sinon le
 *     créneau formulé au micro-exercice 1.5 ;
 *   - formulation de communication ← formulations hiérarchie/collègues (1.5) ;
 *   - signal de concentration ← indicateur visuel + réciprocité (1.5).
 * L'intro cite aussi le « rituel du Cas Sylvie » : la PREMIÈRE réponse de
 * `savedAnswers` évoquant un rituel pré-remplit le 1er champ de la première
 * habitude « rituel » — l'appelant place le rituel décrit au micro-exercice
 * 3.1 AVANT celui du cas Sylvie (retours de test, P5 : c'est la réponse la
 * plus travaillée). Les « résultats prioritaires n° 1/2/3 » de l'habitude
 * « planification hebdomadaire » repartent des « Résultat n (livrable fini) +
 * créneau » du micro-exercice 2.2 (P5 : ce fléchage manquait). Les champs de
 * réflexion (obstacles, indicateurs, pair) restent à l'apprenant.
 */
export function decorateActionPlan(
  habits: HabitLike[],
  savedForms: SavedForm[],
  fieldAppAnswers?: Record<string, string> | null,
  savedAnswers?: ProjectSavedAnswer[],
): void {
  const ritual = (savedAnswers ?? []).find((a) => /rituel/i.test(a.prompt))?.answer;
  if (ritual) {
    const ritualHabit = habits.find((h) => /rituel/i.test(h.title));
    const first = ritualHabit?.fields[0];
    if (first && typeof first !== "string" && !first.prefill) first.prefill = ritual;
  }
  // Habitude « planification hebdomadaire » : résultat n ← « Résultat n … » (2.2).
  const planHabit = habits.find((h) => /planification hebdo/i.test(h.title));
  const planForm = savedForms.find((f) => /planification hebdo/i.test(f.prompt));
  if (planHabit && planForm) {
    for (const f of planHabit.fields) {
      if (typeof f === "string" || f.prefill) continue;
      const m = /r[ée]sultat prioritaire n[°o]\s*(\d)/i.exec(f.label);
      if (!m) continue;
      const src = Object.entries(planForm.fields).find(([k, v]) => new RegExp(`r[ée]sultat\\s*${m[1]}`, "i").test(k) && v.trim());
      if (src) f.prefill = src[1]!.trim();
    }
  }

  const habit = habits.find((h) => /temps prot[ée]g[ée]/i.test(h.title));
  if (!habit) return;
  const form = savedForms.find((f) => /temps prot[ée]g[ée]/i.test(f.prompt));
  const fromForm = (re: RegExp): string | undefined => {
    for (const [k, v] of Object.entries(form?.fields ?? {})) if (re.test(k) && v.trim()) return v.trim();
    return undefined;
  };
  const tested = Object.entries(fieldAppAnswers ?? {})
    .find(([k, v]) => /temps prot[ée]g[ée].*mise en (œ|oe)uvre/i.test(k) && v.trim())?.[1]?.trim();

  for (const f of habit.fields) {
    if (typeof f === "string" || f.prefill) continue;
    if (/habitude concrète/i.test(f.label)) {
      const v = tested ?? fromForm(/créneau/i);
      if (v) f.prefill = v;
    } else if (/formulation/i.test(f.label)) {
      // Zones multi-lignes côté PWA (P10) → une formulation par ligne.
      const lines = Object.entries(form?.fields ?? {})
        .filter(([k, v]) => /formulation/i.test(k) && v.trim())
        .map(([k, v]) => `${k} : ${v.trim()}`);
      if (lines.length) f.prefill = lines.join("\n");
    } else if (/signal/i.test(f.label)) {
      const v = fromForm(/indicateur visuel|signal/i);
      if (v) f.prefill = v;
    }
  }
}

/**
 * Décore (en place) les étapes d'une Application terrain :
 *   - étape dont l'intro évoque le Moment d'Ancrage → 1er champ pré-rempli
 *     avec le PAM de l'apprenant ;
 *   - champs « … — mise en œuvre … » → réponses réelles des micro-exercices.
 */
export function decorateFieldApplication(
  steps: StepLike[],
  momentAncrage: string | null | undefined,
  savedForms: SavedForm[],
): void {
  for (const step of steps) {
    if (momentAncrage?.trim() && /moment d[’']ancrage/i.test(step.intro ?? "") && step.fields[0] && !step.fields[0].prefill) {
      step.fields[0].prefill = momentAncrage.trim();
    }
    for (const field of step.fields) {
      if (field.prefill) continue;
      const v = prefillFromForms(field.label, savedForms);
      if (v) field.prefill = v;
    }
  }
}
