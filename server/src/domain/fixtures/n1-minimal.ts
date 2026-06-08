/**
 * n1-minimal.ts — a small but POLICY-VALID Level 1 course used to smoke-test the
 * model end-to-end. It is intentionally minimal (one micro-session per block, one
 * question per quiz) — Step 2 will ingest the full real "Gestion du temps N1"
 * course from course_extracted.md. The PAM token is placed at all four mandated
 * touchpoints so this document is publishable.
 */
import { MOMENT_ANCRAGE_TOKEN, type CourseContent } from "../content-model.js";

const T = MOMENT_ANCRAGE_TOKEN;

const video = (title: string) => ({
  title,
  url: "",
  durationSec: 228,
  keyMessage: "",
  africanExample: "",
  errorToAvoid: "",
  scriptText: "",
});

const microSession = (id: string, title: string, withPam = false) => ({
  id,
  title,
  durationEstimate: "20 min",
  summaryPoints: ["Point 1", "Point 2", "Point 3"],
  video: video(title),
  exercise: {
    type: "multi" as const,
    prompt: withPam
      ? `D'après ${T}, classez vos activités entre temps polychronique et monochronique.`
      : "Classez vos activités.",
    feedbackText: "Bien vu — votre dossier prioritaire est une zone à protéger.",
    options: [
      { key: "A" as const, label: "Activité polychronique" },
      { key: "B" as const, label: "Activité monochronique" },
    ],
    correctKey: "B" as const,
  },
});

export const n1Minimal: CourseContent = {
  title: "Gestion du Temps & Productivité en Environnements Professionnels Africains",
  level: 1,
  language: "fr",
  domain: { code: "D4", label: "Productivité & organisation" },
  competencies: [
    { code: "D4.C1", label: "Organisation personnelle" },
    { code: "D4.C2", label: "Gestion des priorités" },
    { code: "D4.C3", label: "Gestion du temps & interruptions" },
    { code: "D4.C4", label: "Performance durable" },
  ],
  summary: "Parcours Niveau 1 — Fondamentaux.",
  objective: "À la fin, vous maîtriserez les fondamentaux du sujet.",
  audience: "Professionnels en environnements africains.",
  durationEstimate: "~8 h",
  passThreshold: 70,
  certificate: {
    title: "Certificat de Niveau 1",
    openBadges2: true,
    verificationUrlPattern: "verify.declick.kompetences.net/c/{id}",
  },
  blocks: [
    {
      index: 0,
      type: "ONBOARDING",
      title: "Onboarding & Déclencheur",
      objective: "Créer un engagement personnel immédiat.",
      durationEstimate: "~25 min",
      badge: { type: "ENTRY", label: "Badge d'Entrée", conditions: ["Moment d'Ancrage saisi", "Quiz déclencheur fait", "Pair nommé"] },
      payload: {
        momentAncrage: {
          promptText: "Décrivez une journée type où vous avez eu le sentiment de courir sans avancer sur l'essentiel.",
          minChars: 50,
          placeholderExample: "Mardi : 11 h au bureau à répondre au WhatsApp…",
        },
        profileChoices: [
          { key: "A", name: "Le Débordé réactif", description: "Je réponds à tout dans l'ordre où ça arrive." },
          { key: "B", name: "L'Organisateur submergé", description: "Je planifie mais les imprévus détruisent mes plans." },
        ],
        triggerVideo: video("Occupé ou productif ?"),
        triggerQuiz: {
          questions: [
            { id: "q0.1", text: "Comment vivez-vous le temps au travail ?", options: [
              { key: "A", label: "Plusieurs choses à la fois" },
              { key: "B", label: "Une chose après l'autre" },
            ] },
          ],
        },
        progressPeer: { mandatory: true },
      },
    },
    {
      index: 1,
      type: "COMPREHENSION",
      title: "Comprendre les dynamiques du temps",
      objective: "",
      durationEstimate: "~2 h",
      badge: { type: "COMPREHENSION", label: "Badge Compréhension", conditions: ["Toutes les micro-sessions du Bloc 1 complétées"] },
      payload: {
        diagnosticQuiz: {
          questions: [
            { id: "d1", scenarioText: "Votre matinée est interrompue par WhatsApp. Que faites-vous ?", options: [
              { key: "A", label: "Je réponds tout de suite" },
              { key: "B", label: "Je protège mon temps de fond" },
            ], correctKey: "B", feedbackText: "Protéger un temps de fond est la clé.", subArea: "interruptions" },
          ],
          profiles: [{ scoreRange: [0, 10], name: "Réactif conscient", description: "" }],
        },
        microSessions: [microSession("1.1", "Le temps africain & le temps organisationnel", true)],
      },
    },
    {
      index: 2,
      type: "PRACTICE",
      title: "Pratiquer et progresser",
      objective: "",
      durationEstimate: "~2 h 30",
      badge: { type: "PRACTICE", label: "Badge Pratique", conditions: ["5 micro-sessions complétées", "Application terrain soumise"] },
      payload: {
        microSessions: [microSession("2.1", "Planifier dans l'incertitude")],
        guidedScenarios: [],
        fieldApplication: {
          brief: `Appliquez votre solution dans votre environnement réel, en repartant de ${T}.`,
          minChars: 200,
          gatesNextBlock: true,
        },
      },
    },
    {
      index: 3,
      type: "ANCHORING",
      title: "Installer des habitudes durables",
      objective: "",
      durationEstimate: "~1 h 30",
      badge: { type: "ANCHORING", label: "Badge Ancrage", conditions: ["4 micro-sessions complétées", "Quiz final ≥ 70 %"] },
      payload: {
        microSessions: [microSession("3.1", "Le rituel du temps protégé")],
        selfAssessment: { criteria: ["Organisation", "Priorités"], scale: ["1 - Débutant", "2", "3", "4 - Maîtrise"] },
        actionPlan30d: { habits: [{ title: "Temps protégé matinal", fields: ["Moment", "Durée", "Signal"] }] },
        finalQuiz: {
          questions: [
            { id: "f1", scenarioText: "Quel réflexe installez-vous en premier ?", options: [
              { key: "A", label: "Bloc de temps protégé" },
              { key: "B", label: "Répondre plus vite" },
            ], correctKey: "A", feedbackText: "Le bloc protégé crée la zone monochronique." },
          ],
          passThreshold: 70,
        },
      },
    },
    {
      index: 4,
      type: "CERTIFICATION",
      title: "Mini-projet d'application certifiant",
      objective: "",
      durationEstimate: "~1 h 30",
      badge: { type: "CERTIFICATE", label: "Certificat de Niveau 1", conditions: ["Projet soumis", "6 micro-entrées de journal", "Grille ≥ 70/100"] },
      payload: {
        projectBrief: `Identifier le principal problème de gestion du temps dans votre environnement réel, à partir de ${T}, et documenter l'impact sur 14 jours.`,
        sections: [
          { title: "Contexte (situation de départ)", helpText: "Repartez de votre Moment d'Ancrage.", prefillFromMomentAncrage: true },
          { title: "Problème prioritaire", helpText: "", prefillFromMomentAncrage: false },
          { title: "Solution mise en œuvre", helpText: "", prefillFromMomentAncrage: false },
          { title: "Impact mesuré (14 j)", helpText: "", prefillFromMomentAncrage: false },
          { title: "Apprentissages", helpText: "", prefillFromMomentAncrage: false },
        ],
        journal: {
          entries: [
            { day: 1, prompt: "Première observation depuis le démarrage ?", minWords: 50 },
            { day: 3, prompt: `Vous aviez décrit ${T}. Quel obstacle réel avez-vous rencontré ?`, minWords: 50 },
            { day: 5, prompt: "Qu'avez-vous ajusté ?", minWords: 50 },
            { day: 7, prompt: "Quel progrès concret ?", minWords: 50 },
            { day: 10, prompt: "Quelle résistance culturelle avez-vous gérée ?", minWords: 50 },
            { day: 14, prompt: "Bilan : qu'est-ce qui est désormais ancré ?", minWords: 50 },
          ],
        },
        rubric: {
          criteria: [
            { label: "Organisation personnelle", competencyCode: "D4.C1", weightPoints: 20 },
            { label: "Gestion des priorités", competencyCode: "D4.C2", weightPoints: 20 },
            { label: "Gestion du temps & interruptions", competencyCode: "D4.C3", weightPoints: 20 },
            { label: "Performance durable + journal", competencyCode: "D4.C4", weightPoints: 15 },
            { label: "Ancrage culturel africain", competencyCode: "", weightPoints: 10 },
            { label: "Profondeur de l'apprentissage", competencyCode: "", weightPoints: 15 },
          ],
          totalPoints: 100,
          threshold: 70,
        },
        evaluation: { humanEvaluator: true, turnaroundDays: 5, adminAlertAtDay: 5 },
      },
    },
  ],
};
