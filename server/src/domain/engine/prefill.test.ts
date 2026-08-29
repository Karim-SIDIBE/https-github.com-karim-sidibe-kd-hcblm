import { test } from "node:test";
import assert from "node:assert/strict";
import { coreOf, decorateActionPlan, decorateFieldApplication, normalizeLabel, orderFields, prefillFromForms, savedProjectAnswers, type HabitLike, type SavedForm, type StepLike } from "./prefill.js";

const SAVED: SavedForm[] = [
  {
    prompt: "Mes phrases de signalement et mon rituel de reprise (3 étapes en moins de 2 minutes).",
    fields: {
      "Ma phrase de signalement bienveillant": "Je suis sur le rapport trimestriel, je reviens vers toi à 11h.",
      "Mon rituel de reprise (3 étapes)": "relire · re-focaliser · première micro-action",
    },
  },
  {
    prompt: "Mon système de temps protégé adapté aux codes de mon organisation (réutilisé dans l'Application terrain du Bloc 2).",
    fields: {
      "Mon créneau (de … h à … h) et fréquence/semaine": "7h30-9h, 4 jours/semaine",
      "Ma formulation pour ma hiérarchie": "Je bloque mes matinées pour les dossiers de fond, joignable en urgence réelle.",
    },
  },
  {
    prompt: "Formuler mes « oui différents » pour les 3 situations d'urgence imposée les plus fréquentes.",
    fields: { "Demande de rapport urgent de dernière minute → mon « oui différent »": "Oui, je m'en occupe — je te le livre demain 10h, ça convient ?" },
  },
];

test("normalisation : guillemets, casse et espaces neutralisés", () => {
  assert.equal(normalizeLabel("Mon « OUI  différent »"), "mon oui différent");
});

test("cœur de libellé : partie avant le tiret, sans possessif", () => {
  assert.equal(coreOf("Mon système de temps protégé — mise en œuvre concrète"), "système de temps protégé");
  assert.equal(coreOf("Ma phrase de signalement bienveillant — mise en œuvre concrète"), "phrase de signalement bienveillant");
});

test("préremplissage par champ homonyme : la phrase de signalement revient telle quelle", () => {
  const v = prefillFromForms("Ma phrase de signalement bienveillant — mise en œuvre concrète", SAVED);
  assert.equal(v, "Je suis sur le rapport trimestriel, je reviens vers toi à 11h.");
});

test("préremplissage par consigne : le système de temps protégé revient en lignes libellé : valeur", () => {
  const v = prefillFromForms("Mon système de temps protégé — mise en œuvre concrète", SAVED);
  assert.ok(v?.includes("7h30-9h, 4 jours/semaine"));
  assert.ok(v?.includes("Ma formulation pour ma hiérarchie :"));
});

test("tolérance singulier/pluriel : « oui différent » retrouve « oui différents »", () => {
  const v = prefillFromForms("Mon « oui différent » avec ma hiérarchie — mise en œuvre concrète", SAVED);
  assert.ok(v?.includes("demain 10h"));
});

test("les champs hors « mise en œuvre » ne sont jamais préremplis", () => {
  assert.equal(prefillFromForms("Mon système de temps protégé — adaptation culturelle réalisée", SAVED), undefined);
  assert.equal(prefillFromForms("Obstacles culturels africains rencontrés", SAVED), undefined);
});

test("décoration : le PAM va au 1er champ de l'étape qui l'annonce, les outils aux étapes de mise en œuvre", () => {
  const steps: StepLike[] = [
    {
      title: "Étape 1", intro: "Pré-rempli avec votre Moment d'Ancrage du Bloc 0 — complétez et précisez : …",
      fields: [{ label: "La situation de gestion du temps que je veux résoudre" }, { label: "Les obstacles spécifiques à mon organisation" }],
    },
    {
      title: "Étape 2", intro: "Reprenez votre système de temps protégé.",
      fields: [
        { label: "Mon système de temps protégé — mise en œuvre concrète" },
        { label: "Mon système de temps protégé — adaptation culturelle réalisée" },
      ],
    },
  ];
  decorateFieldApplication(steps, "Chaque lundi, je perds ma matinée en urgences imposées.", SAVED);
  assert.equal(steps[0]!.fields[0]!.prefill, "Chaque lundi, je perds ma matinée en urgences imposées.");
  assert.equal(steps[0]!.fields[1]!.prefill, undefined);
  assert.ok(steps[1]!.fields[0]!.prefill?.includes("7h30-9h"));
  assert.equal(steps[1]!.fields[1]!.prefill, undefined);
});

test("orderFields : les réponses reprennent l'ordre des champs du contenu (jsonb ne le garantit pas)", () => {
  const stored = { "Champ B": "b", "Champ A": "a", "Champ hors contenu": "x" };
  const ordered = orderFields(stored, ["Champ A", "Champ B", "Champ C absent"]);
  assert.deepEqual(Object.keys(ordered), ["Champ A", "Champ B", "Champ hors contenu"]);
});

const PLAN_HABITS = (): HabitLike[] => [
  { title: "Habitude 1 — Semaines 1 et 2 : le rituel de lancement de journée", fields: [
    { label: "L'habitude concrète : chaque matin, je passe … minutes à identifier ma priorité" },
    { label: "L'obstacle africain que j'anticipe" },
  ] },
  { title: "Habitude 2 — Semaines 2 et 3 : le système de temps protégé", fields: [
    { label: "L'habitude concrète : chaque semaine, je protège … plage(s) de … minutes" },
    { label: "Ma formulation de communication" },
    { label: "Mon signal de concentration adapté à mon bureau africain" },
  ] },
];
const MS15_FORM: SavedForm = {
  prompt: "Mon système de temps protégé adapté aux codes de mon organisation.",
  fields: {
    "Mon créneau (de … h à … h) et fréquence/semaine": "De 8 h à 9 h 30, 4 matins par semaine",
    "Ma formulation pour ma hiérarchie": "Je bloque 90 min chaque matin",
    "Ma formulation pour mes collègues": "Casque orange = focus, revenez à 10 h",
    "Mon indicateur visuel + mon geste de réciprocité": "Casque orange + urgences couvertes 15 h-16 h",
  },
};

test("plan d'action : l'habitude « temps protégé » repart des réponses du 1.5", () => {
  const habits = PLAN_HABITS();
  decorateActionPlan(habits, [MS15_FORM]);
  const h2 = habits[1]!.fields as { label: string; prefill?: string }[];
  assert.equal(h2[0]!.prefill, "De 8 h à 9 h 30, 4 matins par semaine");
  assert.ok(h2[1]!.prefill?.includes("Ma formulation pour ma hiérarchie : Je bloque 90 min chaque matin"));
  assert.ok(h2[1]!.prefill?.includes("Ma formulation pour mes collègues : Casque orange = focus, revenez à 10 h"));
  assert.equal(h2[2]!.prefill, "Casque orange + urgences couvertes 15 h-16 h");
  // L'habitude 1 (rituel du matin) n'a pas de source fiable → rien.
  const h1 = habits[0]!.fields as { label: string; prefill?: string }[];
  assert.ok(h1.every((f) => !f.prefill));
});

test("plan d'action : la version testée sur le terrain (Application terrain) prime sur le 1.5", () => {
  const habits = PLAN_HABITS();
  decorateActionPlan(habits, [MS15_FORM], {
    "Mon système de temps protégé — mise en œuvre concrète": "Créneau tenu 3 matins sur 4, négocié avec ma directrice",
    "Mon système de temps protégé — adaptation culturelle réalisée": "Signal repris en réunion d'équipe",
  });
  const h2 = habits[1]!.fields as { label: string; prefill?: string }[];
  assert.equal(h2[0]!.prefill, "Créneau tenu 3 matins sur 4, négocié avec ma directrice");
  assert.equal(h2[2]!.prefill, "Casque orange + urgences couvertes 15 h-16 h");
});

test("savedProjectAnswers : seules les réponses ouvertes savedForProject soumises sortent", () => {
  const caseSpec = { structuredSteps: [{ questions: [
    { id: "q1", kind: "mcq", prompt: "QCM", savedForProject: false },
    { id: "q2", kind: "open", prompt: "Réflexion libre", savedForProject: false },
    { id: "q3", kind: "open", prompt: "Le rituel à installer en premier", savedForProject: true },
    { id: "q4", kind: "open", prompt: "Autre réponse pour le projet", savedForProject: true },
  ] }] };
  const out = savedProjectAnswers("ANCHORING", caseSpec, { q2: "libre", q3: "Mon rituel du matin : 10 min avant WhatsApp.", q4: "  " });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { prompt: "Le rituel à installer en premier", answer: "Mon rituel du matin : 10 min avant WhatsApp.", blockType: "ANCHORING" });
  assert.deepEqual(savedProjectAnswers("COMPREHENSION", caseSpec, null), []);
});

test("plan d'action : le rituel du Cas Sylvie pré-remplit la PREMIÈRE habitude « rituel » (pas la planification hebdo)", () => {
  const habits: HabitLike[] = [
    { title: "Habitude 1 — le rituel de lancement de journée", fields: [{ label: "L'habitude concrète : chaque matin…" }, { label: "Le moment précis · la durée (min)" }] },
    { title: "Habitude 3 — le rituel de planification hebdomadaire", fields: [{ label: "L'habitude concrète : chaque … (jour)" }] },
  ];
  decorateActionPlan(habits, [], null, [{ prompt: "Quel est le rituel de productivité que vous allez installer EN PREMIER ?", answer: "Chaque matin 7 h 45, 10 minutes cahier fermé.", blockType: "ANCHORING" }]);
  assert.equal((habits[0]!.fields[0] as { prefill?: string }).prefill, "Chaque matin 7 h 45, 10 minutes cahier fermé.");
  assert.equal((habits[0]!.fields[1] as { prefill?: string }).prefill, undefined);
  assert.equal((habits[1]!.fields[0] as { prefill?: string }).prefill, undefined);
});

test("plan d'action (P5) : les résultats prioritaires 1-3 repartent des « Résultat n » du micro-exercice 2.2", () => {
  const habits: HabitLike[] = [
    { title: "Habitude 3 — Semaines 3 et 4 : le rituel de planification hebdomadaire", fields: [
      { label: "L'habitude concrète : chaque … (jour), à … h" },
      { label: "Mon résultat prioritaire n° 1 de la semaine prochaine (à faire maintenant)" },
      { label: "Mon résultat prioritaire n° 2" },
      { label: "Mon résultat prioritaire n° 3" },
    ] },
  ];
  const planForm: SavedForm = {
    prompt: "Ma planification hebdomadaire africaine : 3 résultats attendus, leur créneau, et mon buffer.",
    fields: {
      "Résultat 1 (livrable fini) + créneau": "Rapport trimestriel envoyé — mardi matin",
      "Résultat 2 (livrable fini) + créneau": "Réunion budget préparée — mercredi 14 h",
      "Résultat 3 (livrable fini) + créneau": "",
      "Mon buffer africain (% du temps réservé)": "30 %",
    },
  };
  decorateActionPlan(habits, [planForm]);
  const f = habits[0]!.fields as { label: string; prefill?: string }[];
  assert.equal(f[0]!.prefill, undefined); // le « quand » reste à l'apprenant
  assert.equal(f[1]!.prefill, "Rapport trimestriel envoyé — mardi matin");
  assert.equal(f[2]!.prefill, "Réunion budget préparée — mercredi 14 h");
  assert.equal(f[3]!.prefill, undefined); // réponse vide → pas de préremplissage
});

test("plan d'action (P5) : le rituel écrit en 3.1 prime sur celui du Cas Sylvie (ordre des réponses candidates)", () => {
  const habits: HabitLike[] = [{ title: "Habitude 1 — le rituel de lancement de journée", fields: [{ label: "L'habitude concrète : chaque matin…" }] }];
  decorateActionPlan(habits, [], null, [
    { prompt: "Quel rituel de productivité allez-vous installer EN PREMIER dans les 7 prochains jours ?", answer: "3.1 : 10 min chaque matin avant WhatsApp.", blockType: "ANCHORING" },
    { prompt: "Réflexion ouverte — Quel est le rituel de productivité…", answer: "Sylvie : autre rituel.", blockType: "ANCHORING" },
  ]);
  assert.equal((habits[0]!.fields[0] as { prefill?: string }).prefill, "3.1 : 10 min chaque matin avant WhatsApp.");
});

test("plan d'action : sans source, aucun préremplissage ; champs historiques (chaînes) ignorés sans plantage", () => {
  const habits: HabitLike[] = [{ title: "Habitude 2 — le système de temps protégé", fields: ["Mon champ historique", { label: "Ma formulation de communication" }] }];
  decorateActionPlan(habits, []);
  assert.equal((habits[0]!.fields[1] as { prefill?: string }).prefill, undefined);
});

test("sans données sources : aucun préremplissage, aucun plantage", () => {
  const steps: StepLike[] = [{ title: "Étape 1", intro: "Pré-rempli avec votre Moment d'Ancrage : …", fields: [{ label: "La situation" }] }];
  decorateFieldApplication(steps, null, []);
  assert.equal(steps[0]!.fields[0]!.prefill, undefined);
});
