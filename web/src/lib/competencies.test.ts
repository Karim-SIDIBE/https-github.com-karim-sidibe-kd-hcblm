import { test } from "node:test";
import assert from "node:assert/strict";
import { competencyNames, criterionLabel, critLabel, humanizeCodes } from "./competencies";

const CONTENT = {
  competencies: [
    { code: "D1.C1", label: "Clarté et structuration du message" },
    { code: "D1.C2", label: "Écoute active et reformulation" },
    { code: "D1.C3", label: "Prise de parole et impact" },
    { code: "D1.C4", label: "Communication écrite professionnelle" },
  ],
};

test("competencyNames : carte code → libellé, tolérante aux contenus partiels", () => {
  const names = competencyNames(CONTENT);
  assert.equal(names["D1.C1"], "Clarté et structuration du message");
  assert.deepEqual(competencyNames(null), {});
  assert.deepEqual(competencyNames({}), {});
  assert.deepEqual(competencyNames({ competencies: [{ code: "X" }, { label: "sans code" }] }), {});
});

test("humanizeCodes : les codes embarqués dans un texte deviennent des libellés", () => {
  const names = competencyNames(CONTENT);
  // Cas réel de la recette du 06/10/2026 : textes d'aide importés de Word.
  assert.equal(
    humanizeCodes("l'objectif annoncé dès l'ouverture (D1.C1) • Mes reformulations (D1.C2)", names),
    "l'objectif annoncé dès l'ouverture (Clarté et structuration du message) • Mes reformulations (Écoute active et reformulation)",
  );
  // Un code inconnu de la carte (ex. S1 du socle, non listé) reste tel quel.
  assert.equal(humanizeCodes("le critère S1 du socle lit la régularité", names), "le critère S1 du socle lit la régularité");
  // Pas de carte → texte inchangé.
  assert.equal(humanizeCodes("rien à faire (D1.C1)", {}), "rien à faire (D1.C1)");
});

test("criterionLabel : « Compétence N » (import Word) → libellé du référentiel via competencyCode", () => {
  const names = competencyNames(CONTENT);
  assert.equal(criterionLabel({ label: "Compétence 1", competencyCode: "D1.C1" }, names), "Clarté et structuration du message");
  assert.equal(criterionLabel({ label: "Compétence 3", competencyCode: "D1.C3" }, names), "Prise de parole et impact");
  // Le code seul comme intitulé → libellé aussi.
  assert.equal(criterionLabel({ label: "D1.C2", competencyCode: "D1.C2" }, names), "Écoute active et reformulation");
});

test("criterionLabel : un intitulé déjà parlant est conservé (codes en tête retirés, embarqués traduits)", () => {
  const names = competencyNames(CONTENT);
  // Grille canonique Gestion du Temps : intitulés propres — inchangés.
  assert.equal(criterionLabel({ label: "Organisation personnelle", competencyCode: "D4.C1" }, names), "Organisation personnelle");
  assert.equal(criterionLabel({ label: "Ancrage contextuel + journal" }, names), "Ancrage contextuel + journal");
  // Code en tête (règle P7 historique) toujours retiré.
  assert.equal(critLabel("S1 — Régularité de la pratique"), "Régularité de la pratique");
  // Code embarqué dans l'intitulé → traduit.
  assert.equal(criterionLabel({ label: "Qualité du message (D1.C1)" }, names), "Qualité du message (Clarté et structuration du message)");
  // « Compétence N » SANS competencyCode résolvable : on garde l'intitulé plutôt que d'inventer.
  assert.equal(criterionLabel({ label: "Compétence 2" }, names), "Compétence 2");
});
