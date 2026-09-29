/**
 * import-course.test.ts — parseur déterministe du gabarit K-HCBLM : blocs en
 * majuscules SANS style Word, quiz A–D + « Bonne réponse », tableaux (journal,
 * champs), étude de cas, scénarios, garanties de barrière (jetons PAM).
 * Fixture synthétique reproduisant les conventions du document réel v4.1.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocElement } from "../../lib/docx.js";
import { importCourseFromElements } from "./import-course.js";
import { validatePolicy } from "../validation.js";
import { CourseContent, MOMENT_ANCRAGE_TOKEN } from "../content-model.js";

const P = (text: string, bullet = false): DocElement => ({ kind: "p", text, heading: false, bullet });
const TBL = (...rows: string[][]): DocElement => ({ kind: "table", rows });

// Squelette conforme minimal (celui de l'import réel vient de buildScaffold —
// on le reconstruit ici sans dépendre de lib/ai pour rester en domaine pur).
import { readFileSync } from "node:fs";
void readFileSync;
import { LEVEL_PASS_THRESHOLD } from "../content-model.js";
function scaffold() {
  const T = MOMENT_ANCRAGE_TOKEN;
  return CourseContent.parse({
    title: "Gabarit", level: 1, domain: { code: "D9", label: "À définir" },
    competencies: [{ code: "D9.C1", label: "C1" }],
    passThreshold: LEVEL_PASS_THRESHOLD[1],
    certificate: { title: "Certificat", openBadges2: true },
    blocks: [
      { index: 0, type: "ONBOARDING", title: "Onboarding", badge: { type: "ENTRY", label: "Entrée", conditions: ["ok"] },
        payload: { momentAncrage: { promptText: "Décrivez.", minChars: 50 }, profileChoices: [{ key: "A", name: "A", description: "d" }, { key: "B", name: "B", description: "d" }], triggerVideo: { title: "V", url: "", durationSec: 600 }, triggerQuiz: { questions: [{ id: "t1", text: "Q", options: [{ key: "A", label: "a" }, { key: "B", label: "b" }] }] }, progressPeer: { mandatory: true } } },
      { index: 1, type: "COMPREHENSION", title: "Comprendre", badge: { type: "COMPREHENSION", label: "B1", conditions: ["ok"] },
        payload: { diagnosticQuiz: { questions: [{ id: "d1", scenarioText: "S", options: [{ key: "A", label: "a" }, { key: "B", label: "b" }], correctKey: "A", feedbackText: "f" }], profiles: [{ scoreRange: [0, 10], name: "P" }] }, microSessions: [{ id: "1.1", title: "S", durationEstimate: "20 min", summaryPoints: ["a", "b", "c"], video: { title: "V", url: "", durationSec: 300 }, exercise: { type: "written", prompt: `De ${T}.`, feedbackText: "f", minChars: 50 } }] } },
      { index: 2, type: "PRACTICE", title: "Pratiquer", badge: { type: "PRACTICE", label: "B2", conditions: ["ok"] },
        payload: { microSessions: [{ id: "2.1", title: "S", durationEstimate: "20 min", summaryPoints: ["a", "b", "c"], video: { title: "V", url: "", durationSec: 300 } }], fieldApplication: { brief: `Sur ${T}.`, minChars: 200 } } },
      { index: 3, type: "ANCHORING", title: "Ancrer", badge: { type: "ANCHORING", label: "B3", conditions: ["ok"] },
        payload: { microSessions: [{ id: "3.1", title: "S", durationEstimate: "20 min", summaryPoints: ["a", "b", "c"], video: { title: "V", url: "", durationSec: 300 } }], selfAssessment: { criteria: ["c"], scale: ["1", "2"] }, actionPlan30d: { habits: [{ title: "H", fields: ["f"] }] }, finalQuiz: { questions: [{ id: "f1", scenarioText: "S", options: [{ key: "A", label: "a" }, { key: "B", label: "b" }], correctKey: "A", feedbackText: "f" }], passThreshold: 70 } } },
      { index: 4, type: "CERTIFICATION", title: "Certifier", badge: { type: "CERTIFICATE", label: "C", conditions: ["ok"] },
        payload: { projectBrief: `Projet sur ${T}.`, sections: [
          { title: "Section 1", prefillFromMomentAncrage: true }, { title: "Section 2" }, { title: "Section 3" }, { title: "Section 4" }, { title: "Section 5" }],
          journal: { entries: [{ day: 1, prompt: `${T} ?` }, { day: 3, prompt: "b" }, { day: 5, prompt: "c" }, { day: 7, prompt: "d" }, { day: 10, prompt: "e" }, { day: 14, prompt: "f" }] },
          rubric: { criteria: [{ label: "C1", weightPoints: 50 }, { label: "C2", weightPoints: 50 }], totalPoints: 100, threshold: 70 },
          evaluation: { humanEvaluator: true } } },
    ],
  });
}

/** Fixture synthétique — mêmes conventions que le document réel. */
function fixture(): DocElement[] {
  return [
    P("KOMPETENCES DECLICK · Parcours certifiant"),
    P("GESTION DES CONFLITS EN ENVIRONNEMENTS PROFESSIONNELS AFRICAINS"),
    P("NIVEAU 1 : FONDAMENTAUX"),
    TBL(["D4.C1", "Prévention du conflit", "…"], ["D4.C2", "Médiation simple", "…"]),
    P("BLOC 0 — ONBOARDING & DÉCLENCHEUR   (~20 MIN · 1 MICRO-SESSION · 0 ACTIVITÉ LONGUE · 0 MICRO-TÂCHE)"),
    P("MICRO-SESSION 0.1 — BLOC 0 COMPLET   (~20 MIN)"),
    P("MOMENT D'ANCRAGE — Pilier 1   2 min"),
    TBL(["« Décrivez en une phrase le conflit que vous traversez. »"]),
    P("PROFIL AUTO-DÉCLARÉ — Pilier 1   1 min"),
    P("« Parmi ces quatre descriptions, laquelle vous correspond ? »"),
    P("A — L'Évitant : je fuis le conflit.", true),
    P("B — Le Frontal : je fonce dans le tas.", true),
    P("C — Le Médiateur né : je tempère tout.", true),
    P("D — L'Accumulateur : je stocke puis j'explose.", true),
    P("VIDÉO DÉCLENCHEUR — Vidéo 1 : « Le conflit qui a coûté un contrat »   10 min"),
    P("MESSAGE CLÉ : Un conflit non traité ne disparaît jamais."),
    P("EXEMPLE AFRICAIN : Awa, 30 ans, cheffe d'équipe à Dakar."),
    P("ERREUR À ÉVITER : Croire que le temps arrange les choses."),
    P("Script intégral prêt au tournage"),
    P("[Face caméra. Ton direct.] Narration complète de la vidéo déclencheur ici."),
    P("Quiz de déclencheur — 5 questions   3 min · non noté"),
    P("Question 1"),
    P("Face à un désaccord avec un collègue, que faites-vous le plus souvent ?"),
    P("A.  Je laisse passer."),
    P("B.  J'en parle immédiatement."),
    P("(Aucune réponse n'est incorrecte — chacune précise votre profil.)"),
    P("Carte de rappel — les 3 points clés du Bloc 0   2 min"),
    P("Votre phrase d'ancrage est le fil rouge du parcours.", true),
    P("Votre profil auto-déclaré oriente les exemples.", true),
    P("Le parcours reprend exactement où vous vous êtes arrêté.", true),
    P("BLOC 1 — COMPRENDRE LE CONFLIT   (~2H20 · 3 MICRO-SESSIONS · 0 ACTIVITÉ LONGUE · 0 MICRO-TÂCHE)"),
    P("MICRO-SESSION 1.0 — QUIZ DIAGNOSTIQUE   (~15 MIN · LMS NATIF · AVANT LES VIDÉOS)"),
    P("Question 1"),
    P("Votre chef critique votre travail en réunion. Que faites-vous ?"),
    P("A.  Je réponds sur le champ."),
    P("B.  Je demande un entretien privé."),
    P("C.  Je me tais définitivement."),
    P("D.  J'en parle aux collègues."),
    P("Bonne réponse : B — L'entretien privé préserve la relation hiérarchique."),
    P("Question 2"),
    P("Deux membres de votre équipe ne se parlent plus. Que faites-vous ?"),
    P("A.  J'attends que ça passe."),
    P("B.  Je les convoque ensemble."),
    P("C.  Je les écoute séparément d'abord."),
    P("D.  Je préviens la direction."),
    P("Bonne réponse : C — Écouter séparément évite l'escalade publique."),
    P("MICRO-SESSION 1.1 — VIDÉO 2 + MICRO-EXERCICE   (~20 MIN)"),
    P("Vidéo 2 — Nommer le désaccord sans accuser   6 min"),
    P("MESSAGE CLÉ : Le conflit se désamorce quand on décrit des faits."),
    P("EXEMPLE AFRICAIN : Kossi, 27 ans, technicien à Lomé."),
    P("ERREUR À ÉVITER : Dire « tu » au lieu de décrire le fait."),
    P("Script intégral prêt au tournage"),
    P("[Face caméra.] Texte intégral de narration de la vidéo 2."),
    P("MICRO-EXERCICE 2 — « Mes trois faits »   7 min · LMS natif"),
    P("Prenez un désaccord réel de cette semaine et remplissez le tableau."),
    TBL(["Élément", "Ma réponse", "Contrôle LMS"], ["Le fait précis, daté", "________", "Alerte si jugement"], ["Ce que cela m'a coûté", "________", "Champ obligatoire"]),
    P("→ Résultat LMS immédiat : votre désaccord est classé « factuel » ou « accusatoire »."),
    P("MICRO-SESSION 1.2 — ÉTUDE DE CAS AMINATA   (~25 MIN · LMS NATIF)"),
    P("Cas : « Aminata : deux services, un silence »"),
    TBL(["Aminata dirige la comptabilité à Cotonou. Depuis trois mois, la logistique ne lui transmet plus rien."]),
    P("ÉTAPE 1 — Analyser   8 min"),
    P("Question 1.1"),
    P("Quelle est la cause racine du silence entre les deux services ?"),
    P("A.  Un conflit de personnes."),
    P("B.  Un différend jamais nommé devenu norme de fonctionnement."),
    P("Bonne réponse : B — Le silence institutionnalisé est un conflit gelé."),
    P("Question 1.2 — Réflexion ouverte"),
    P("En quoi cette situation ressemble-t-elle à votre Moment d'Ancrage ? Réponse sauvegardée et réutilisée dans le projet certifiant du Bloc 4."),
    P("Votre réponse : ________________________"),
    P("FIN DU BLOC 1 — Badge Compréhension débloqué."),
    P("BLOC 2 — PRATIQUER LA RÉSOLUTION   (~2H · 1 MICRO-SESSION · 2 ACTIVITÉS LONGUES · 0 MICRO-TÂCHE)"),
    P("MICRO-SESSION 2.1 — VIDÉO 3 + EXERCICE   (~20 MIN)"),
    P("Vidéo 3 — La médiation entre pairs   6 min"),
    P("MESSAGE CLÉ : On ne tranche pas entre pairs, on fait émerger."),
    P("ACTIVITÉ EXPÉRIENTIELLE LONGUE — MISES EN SITUATION GUIDÉES   (~30 MIN · LMS NATIF)"),
    P("Scénario 1 — Désamorcer un conflit d'équipe à Abidjan, Côte d'Ivoire   ~10 min"),
    TBL(["Contexte : vous supervisez deux équipes qui se rejettent la faute d'un retard."]),
    P("Décision D1"),
    P("Par quoi commencez-vous ?"),
    P("A.  Une réunion commune immédiate."),
    P("B.  Deux entretiens séparés pour établir les faits."),
    P("Bonne réponse : B — Les faits d'abord, la confrontation ensuite."),
    P("ACTIVITÉ EXPÉRIENTIELLE LONGUE — APPLICATION TERRAIN   (~35 MIN · SOUMISSION LMS · OBLIGATOIRE)"),
    TBL(["L'application terrain est obligatoire pour l'accès au Bloc 4. Votre Moment d'Ancrage est affiché."]),
    P("Mission — Traiter un désaccord réel cette semaine"),
    P("Étape 1 — Choisir la situation  (~10 min)"),
    P("[Pré-rempli avec votre Moment d'Ancrage du Bloc 0.]"),
    P("Le désaccord que je choisis de traiter : ______________________"),
    P("Ce qu'il m'a déjà coûté : ______________________"),
    P("FIN DU BLOC 2 — Badge Pratique débloqué."),
    P("BLOC 3 — ANCRER   (~1H30 · 2 MICRO-SESSIONS · 0 ACTIVITÉ LONGUE · 0 MICRO-TÂCHE)"),
    P("MICRO-SESSION 3.1 — VIDÉO 4 + GRILLE D'AUTO-ÉVALUATION   (~20 MIN)"),
    P("Vidéo 4 — Les rituels anti-conflit   6 min"),
    P("MESSAGE CLÉ : La prévention est un rituel, pas un talent."),
    P("GRILLE D'AUTO-ÉVALUATION — 3 critères   10 min · LMS natif"),
    P("Évaluez-vous honnêtement de 1 à 4 sur chaque critère."),
    TBL(["Critère", "Compétence", "1 — Jamais", "2 — Parfois", "3 — Souvent", "4 — Toujours"],
      ["Je nomme les désaccords tôt", "D4.C1", "☐", "☐", "☐", "☐"],
      ["Je décris des faits, pas des personnes", "D4.C1", "☐", "☐", "☐", "☐"],
      ["Je vérifie l'accord final par écrit", "D4.C2", "☐", "☐", "☐", "☐"]),
    P("MICRO-SESSION 3.2 — PLAN D'ACTION PERSONNEL 30 JOURS   (~20 MIN · SOUMISSION LMS)"),
    P("Transformez vos apprentissages en engagements datés."),
    P("HABITUDE 1 — Semaines 1 et 2 : nommer tôt  (compétence D4.C1)"),
    P("L'habitude concrète : ______________________"),
    P("Mon déclencheur : ______________________"),
    P("MICRO-SESSION 3.3 — QUIZ FINAL DE VALIDATION   (~15 MIN · LMS NATIF · NOTÉ)"),
    TBL(["Quiz final noté · 2 questions · Seuil de réussite : 70 % · Score immédiat"]),
    P("Question 1"),
    P("Un fournisseur conteste une pénalité devant témoins. Que faites-vous ?"),
    P("A.  Je maintiens publiquement la pénalité."),
    P("B.  Je propose un point privé pour examiner les faits."),
    P("Bonne réponse : B — Le retrait du public permet l'accord."),
    P("Question 2"),
    P("Après une médiation réussie, que faites-vous ?"),
    P("A.  Rien, le problème est réglé."),
    P("B.  J'écris l'accord et je le partage aux deux parties."),
    P("Bonne réponse : B — Un accord non écrit redevient un différend."),
    P("FIN DU BLOC 3 — Badge Ancrage débloqué."),
    P("BLOC 4 — MINI-PROJET D'APPLICATION CERTIFIANT   (~1H30 · 4 MICRO-SESSIONS · 1 ACTIVITÉ LONGUE · 6 MICRO-TÂCHES)"),
    P("Sujet du mini-projet"),
    TBL(["« Choisissez un désaccord réel et traitez-le en quinze jours avec les outils du parcours. »"]),
    P("MICRO-SESSION 4.1 — SECTION 1 : LA SITUATION   (~15 MIN · SOUMISSION LMS)"),
    P("Environ dix lignes : le contexte, votre rôle, le désaccord et son coût."),
    P("_______________________________________________"),
    P("MICRO-SESSION 4.2 — SECTION 2 : CE QUE J'AI FAIT   (~15 MIN · SOUMISSION LMS)"),
    P("Rapportez des faits datés avec vos mots exacts."),
    P("MICRO-SESSION 4.3 — SECTION 3 : LE RÉSULTAT   (~15 MIN · SOUMISSION LMS)"),
    P("Ce qui a été décidé, et pour quelle date : ______________________"),
    P("ACTIVITÉ EXPÉRIENTIELLE LONGUE — SECTION 4 : JOURNAL DE PRATIQUE EN 6 MICRO-ENTRÉES   (~30 MIN CUMULÉS)"),
    TBL(["Entrée", "Délai", "Durée", "Compétence", "Question posée par la plateforme"],
      ["1", "J+2", "5 min", "D4.C1", "Quel désaccord avez-vous nommé ces deux derniers jours ?"],
      ["2", "J+4", "5 min", "D4.C1", "Décrivez un fait daté que vous avez énoncé sans jugement."],
      ["3", "J+6", "5 min", "D4.C2", "Quelle médiation avez-vous tentée ?"],
      ["4", "J+9", "5 min", "D4.C2", "Quel accord avez-vous mis par écrit ?"],
      ["5", "J+11", "5 min", "D4.C1", "Quel signal faible de conflit avez-vous repéré ?"],
      ["6", "J+15", "5 min", "Synthèse", "Qu'est-ce qui a changé en quinze jours ?"]),
    P("MICRO-SESSION 4.4 — SECTION 5 : APPRENTISSAGE PERSONNEL   (~15 MIN · SOUMISSION LMS)"),
    P("Une habitude que j'ai révisée pendant ces quinze jours : ______________________"),
    TBL(["Seuil de certification : 70 points sur 100, avec un minimum par critère fixé par le socle"]),
  ];
}

test("import réel : blocs détectés SANS styles Word (majuscules), titres et durées", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  assert.equal(content.title, "Gestion des conflits en environnements professionnels africains");
  assert.equal(content.level, 1);
  assert.equal(content.blocks[1]!.title, "Comprendre le conflit");
  assert.equal(content.blocks[1]!.durationEstimate, "~2 h 20");
});

test("compétences et domaine repris de la table de codes Dx.Cy", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  assert.deepEqual(content.competencies.map((c) => c.code), ["D4.C1", "D4.C2"]);
  assert.equal(content.domain.code, "D4");
});

test("Bloc 0 : Moment d'Ancrage (tableau), 4 profils, vidéo déclencheur + script, quiz profilant", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const p = content.blocks[0]!.payload as never as Record<string, never>;
  const pay = content.blocks.find((b) => b.type === "ONBOARDING")!.payload as Extract<typeof content.blocks[number], { type: "ONBOARDING" }>["payload"];
  assert.match(pay.momentAncrage.promptText, /^Décrivez en une phrase le conflit/);
  assert.equal(pay.profileChoices.length, 4);
  assert.equal(pay.profileChoices[3]!.name, "L'Accumulateur");
  assert.equal(pay.triggerVideo.durationSec, 600);
  assert.match(pay.triggerVideo.scriptText, /Narration complète/);
  assert.equal(pay.triggerQuiz.questions.length, 1);
  assert.equal(pay.triggerQuiz.questions[0]!.options.length, 2);
  void p;
});

test("quiz notés : diagnostic et final complets (énoncé, options, bonne réponse, feedback)", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b1 = content.blocks.find((b) => b.type === "COMPREHENSION")!;
  const dq = (b1.payload as Extract<typeof b1, { type: "COMPREHENSION" }>["payload"]).diagnosticQuiz;
  assert.equal(dq.questions.length, 2);
  assert.equal(dq.questions[0]!.correctKey, "B");
  assert.match(dq.questions[0]!.feedbackText, /entretien privé/);
  assert.equal(dq.questions[1]!.options.length, 4);
  const b3 = content.blocks.find((b) => b.type === "ANCHORING")!;
  const fq = (b3.payload as Extract<typeof b3, { type: "ANCHORING" }>["payload"]).finalQuiz;
  assert.equal(fq.questions.length, 2);
  assert.equal(fq.passThreshold, 70);
});

test("micro-sessions : vidéo (durée en secondes), messages clés, script, exercice guidé depuis le tableau", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b1 = content.blocks.find((b) => b.type === "COMPREHENSION")!;
  const ms = (b1.payload as Extract<typeof b1, { type: "COMPREHENSION" }>["payload"]).microSessions;
  assert.equal(ms.length, 1);
  assert.equal(ms[0]!.id, "1.1");
  assert.equal(ms[0]!.video.durationSec, 360);
  assert.match(ms[0]!.video.keyMessage, /faits/);
  assert.match(ms[0]!.video.scriptText, /narration de la vidéo 2/);
  assert.equal(ms[0]!.exercise?.type, "guidedForm");
  assert.deepEqual(ms[0]!.exercise?.fields?.map((f) => f.label), ["Le fait précis, daté", "Ce que cela m'a coûté"]);
});

test("étude de cas : sous-titre, contexte (tableau), étapes, MCQ + réflexion ouverte sauvegardée", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b1 = content.blocks.find((b) => b.type === "COMPREHENSION")!;
  const cs = (b1.payload as Extract<typeof b1, { type: "COMPREHENSION" }>["payload"]).caseStudy!;
  assert.match(cs.subtitle, /Aminata/);
  assert.match(cs.context, /comptabilité à Cotonou/);
  assert.equal(cs.structuredSteps.length, 1);
  const qs = cs.structuredSteps[0]!.questions;
  assert.equal(qs.length, 2);
  assert.equal(qs[0]!.kind, "mcq");
  assert.equal(qs[0]!.correctKey, "B");
  assert.equal(qs[1]!.kind, "open");
  assert.equal(qs[1]!.savedForProject, true);
});

test("Bloc 2 : scénario guidé (contexte + décisions) et application terrain (mission + étapes à champs)", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b2 = content.blocks.find((b) => b.type === "PRACTICE")!;
  const p = b2.payload as Extract<typeof b2, { type: "PRACTICE" }>["payload"];
  assert.equal(p.guidedScenarios.length, 1);
  assert.match(p.guidedScenarios[0]!.contextAfricain, /deux équipes/);
  assert.equal(p.guidedScenarios[0]!.steps[0]!.correctKey, "B");
  assert.match(p.fieldApplication.brief, /Traiter un désaccord réel/);
  assert.equal(p.fieldApplication.steps?.length, 1);
  assert.equal(p.fieldApplication.steps![0]!.fields.length, 2);
});

test("Bloc 3 : auto-évaluation (critères + échelle du tableau) et plan d'action (habitudes à champs)", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b3 = content.blocks.find((b) => b.type === "ANCHORING")!;
  const p = b3.payload as Extract<typeof b3, { type: "ANCHORING" }>["payload"];
  assert.equal(p.selfAssessment.criteria.length, 3);
  assert.deepEqual(p.selfAssessment.scale, ["1 — Jamais", "2 — Parfois", "3 — Souvent", "4 — Toujours"]);
  assert.match(p.actionPlan30d.habits[0]!.title, /Habitude 1/);
  assert.equal(p.actionPlan30d.habits[0]!.fields.length, 2);
});

test("Bloc 4 : sujet (tableau), 5 sections titrées, journal de 6 entrées J+2→J+15 depuis le tableau", () => {
  const { content } = importCourseFromElements(fixture(), scaffold());
  const b4 = content.blocks.find((b) => b.type === "CERTIFICATION")!;
  const p = b4.payload as Extract<typeof b4, { type: "CERTIFICATION" }>["payload"];
  assert.match(p.projectBrief, /^Choisissez un désaccord réel/);
  assert.equal(p.sections.length, 5);
  assert.match(p.sections[0]!.title, /Section 1/);
  assert.equal(p.sections[0]!.prefillFromMomentAncrage, true);
  assert.match(p.sections[3]!.title, /Journal/i);
  assert.deepEqual(p.journal.entries.map((e) => e.day), [2, 4, 6, 9, 11, 15]);
  assert.match(p.journal.entries[1]!.prompt, /fait daté/);
});

test("garanties de barrière : jetons PAM réinjectés + carte de rappel + document PUBLIABLE", () => {
  const r = importCourseFromElements(fixture(), scaffold());
  assert.ok(r.coverage.fixups.some((f) => f.includes("journal")));
  assert.ok(r.coverage.fixups.some((f) => f.includes("mini-projet")));
  assert.equal(r.content.blocks[0]!.recallCard?.length, 3);
  const parsed = CourseContent.parse(r.content); // forme
  const policy = validatePolicy(parsed); // règles
  assert.deepEqual(policy.issues.filter((i) => i.level === "error"), []);
});

test("couverture : l'essentiel de la fixture est réparti, le reste part en notes par bloc", () => {
  const r = importCourseFromElements(fixture(), scaffold());
  assert.ok(r.coverage.mappedPct >= 85, `couverture ${r.coverage.mappedPct} % < 85 %`);
  assert.equal(r.coverage.totalElements, fixture().length);
});
