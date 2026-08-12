import { test } from "node:test";
import assert from "node:assert/strict";
import { coreOf, decorateFieldApplication, normalizeLabel, orderFields, prefillFromForms, type SavedForm, type StepLike } from "./prefill.js";

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

test("sans données sources : aucun préremplissage, aucun plantage", () => {
  const steps: StepLike[] = [{ title: "Étape 1", intro: "Pré-rempli avec votre Moment d'Ancrage : …", fields: [{ label: "La situation" }] }];
  decorateFieldApplication(steps, null, []);
  assert.equal(steps[0]!.fields[0]!.prefill, undefined);
});
