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
