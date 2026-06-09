/**
 * n1-full.ts — the REAL "Gestion du Temps & Productivité en Environnements
 * Professionnels Africains — Niveau 1" course, transcribed faithfully from
 * project/course_extracted.md into the content model. This is the canonical
 * payload: what the authoring tool must be able to produce and the learner UI
 * must be able to render.
 *
 * Notes on faithful mapping:
 * - Bloc 1: the 5 video+exercise sessions are `microSessions`; the 10-question
 *   diagnostic quiz is `diagnosticQuiz`; the Nadia case is `caseStudy`.
 * - Bloc 2: the 3 video+exercise sessions are `microSessions`; the 3 guided
 *   situations are `guidedScenarios`; the field application is `fieldApplication`.
 *   (The non-scored 6-question inter-block quiz has no slot in the current model
 *   — see README "next steps"; it is intentionally omitted here.)
 * - Bloc 4 rubric uses the updated KOMPETENCES AFRICA D4 referential (6 criteria,
 *   /100, threshold 70) — the final state agreed in the design chat and rendered
 *   in prototype.html.
 */
import type { CourseContent, MicroSession, Video } from "../content-model.js";

const v = (p: {
  title: string;
  durationSec: number;
  keyMessage: string;
  africanExample: string;
  errorToAvoid: string;
}): Video => ({
  title: p.title,
  url: "",
  durationSec: p.durationSec,
  keyMessage: p.keyMessage,
  africanExample: p.africanExample,
  errorToAvoid: p.errorToAvoid,
  scriptText: "",
});

// --- Bloc 1 micro-sessions (videos 2–6 + exercises) -------------------------

const ms11: MicroSession = {
  id: "1.1",
  title: "Le temps africain & le temps organisationnel",
  durationEstimate: "20 min",
  summaryPoints: [
    "Le temps polychronique africain (flexible, relationnel, simultané) coexiste avec le temps monochronique organisationnel.",
    "Comprendre cette tension explique 80 % des problèmes de productivité.",
    "La solution n'est pas de choisir, mais de différencier des zones polychroniques et monochroniques.",
  ],
  video: v({
    title: "Le temps africain et le temps organisationnel : comprendre la tension",
    durationSec: 360,
    keyMessage:
      "Deux conceptions du temps coexistent dans les organisations africaines — polychronique (relationnel) et monochronique (organisationnel). Comprendre cette tension, c'est comprendre 80 % de vos problèmes de productivité.",
    africanExample:
      "Aïssatou, 28 ans, coordinatrice administrative dans une ONG de santé à Dakar — sa journée révèle 7 sujets gérés simultanément sans en terminer aucun.",
    errorToAvoid:
      "Appliquer des méthodes monochroniques occidentales sans les adapter — elles échouent en ignorant les obligations relationnelles africaines.",
  }),
  exercise: {
    type: "guidedForm",
    prompt:
      "Cartographier mes deux types de temps : pour chaque type d'activité, estimez le % de votre temps réel et indiquez si vous voulez le changer.",
    feedbackText:
      "Analyse de votre répartition + recommandations personnalisées selon votre profil de gestion du temps.",
    fields: [
      { label: "Réponse à des demandes non planifiées (messages, visites, appels)", placeholder: "____% — changer ? cible :", prefillFromMomentAncrage: false },
      { label: "Réunions (planifiées et non planifiées)", placeholder: "____% — changer ? cible :", prefillFromMomentAncrage: false },
      { label: "Travail de fond sur mes priorités réelles", placeholder: "____% — changer ? cible :", prefillFromMomentAncrage: false },
      { label: "Mon principal voleur de temps dans mon organisation africaine", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

const ms12: MicroSession = {
  id: "1.2",
  title: "La matrice des priorités revisitée pour le contexte africain",
  durationEstimate: "20 min",
  summaryPoints: [
    "La matrice Urgent/Important fonctionne en Afrique à une condition : distinguer urgences réelles et urgences imposées.",
    "La question-filtre : « quelles conséquences réelles si ce n'est pas traité dans les 2 heures ? »",
    "Le Quadrant 2 (important, pas urgent) est la zone de vraie productivité, la plus systématiquement sacrifiée.",
  ],
  video: v({
    title: "La matrice des priorités revisitée pour le contexte africain",
    durationSec: 360,
    keyMessage:
      "En Afrique presque tout semble urgent — apprendre à filtrer les urgences réelles des urgences imposées est la compétence centrale.",
    africanExample:
      "Chidi, 33 ans, responsable comptabilité dans une multinationale à Lagos — un système de filtrage qui a réduit de 40 % les interruptions traitées dans l'heure.",
    errorToAvoid:
      "Traiter comme urgente toute demande formulée avec « urgent », « dès que possible » ou « maintenant ».",
  }),
  exercise: {
    type: "guidedForm",
    // PAM injection touchpoint (1) — exercise prompt re-injects the anchor.
    prompt:
      "Ma matrice africaine de la semaine : en repartant de {{moment_ancrage}}, listez 2 à 3 tâches réelles dans chaque quadrant.",
    feedbackText:
      "Analyse de votre Quadrant 2 — le principal indicateur de votre potentiel de productivité non exploitée.",
    fields: [
      { label: "Quadrant 1 — Urgent ET important (traiter maintenant)", placeholder: "Exemples de ma semaine", prefillFromMomentAncrage: false },
      { label: "Quadrant 2 — Important, pas urgent (bloquer du temps)", placeholder: "Ma grande priorité ignorée", prefillFromMomentAncrage: true },
      { label: "Quadrant 3 — Urgent pour d'autres (déléguer/différer)", placeholder: "Demandes imposées non essentielles", prefillFromMomentAncrage: false },
      { label: "Quadrant 4 — Ni urgent ni important (éliminer)", placeholder: "Activités à supprimer", prefillFromMomentAncrage: false },
    ],
  },
};

const ms13: MicroSession = {
  id: "1.3",
  title: "La culture de l'urgence africaine : comprendre pour en sortir",
  durationEstimate: "20 min",
  summaryPoints: [
    "La culture de l'urgence n'est pas une fatalité : c'est un mode appris et renforcé collectivement.",
    "5 mécanismes créent l'urgence artificielle (délégation de dernière minute, « urgent » par défaut, réunion non préparée, communication permanente, valorisation de l'urgence).",
    "Chaque collaborateur contribue à cette culture — et peut commencer à la modifier.",
  ],
  video: v({
    title: "La culture de l'urgence africaine : comprendre pour en sortir",
    durationSec: 360,
    keyMessage:
      "La culture de l'urgence est un mode appris ; comprendre ses 5 mécanismes est la première étape pour en sortir sans rompre avec les codes culturels.",
    africanExample:
      "Régine, 30 ans, chargée de communication dans une banque à Douala — identification des 5 mécanismes d'urgence artificielle dans son département.",
    errorToAvoid:
      "Croire que l'urgence vient uniquement de la hiérarchie et qu'on ne peut rien y faire.",
  }),
  exercise: {
    type: "guidedForm",
    prompt:
      "Mes 3 principales sources d'urgence artificielle : identifiez-les et une action concrète pour chacune.",
    feedbackText:
      "Recommandations pour le mécanisme le plus impactant dans votre contexte africain, selon votre profil.",
    fields: [
      { label: "Source 1 + action concrète", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Source 2 + action concrète", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Source 3 + action concrète", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

const ms14: MicroSession = {
  id: "1.4",
  title: "Gérer les interruptions dans les organisations africaines",
  durationEstimate: "20 min",
  summaryPoints: [
    "Les interruptions ne s'éliminent pas, elles se gèrent : le vrai coût est le temps de reprise (≈ 23 min).",
    "Système en 3 temps : signaler sans rejeter, capturer sans traiter, reprendre avec un rituel de 30 s.",
    "Une phrase de signalement bienveillant protège le focus tout en préservant la relation.",
  ],
  video: v({
    title: "Gérer les interruptions dans les organisations africaines",
    durationSec: 360,
    keyMessage:
      "La différence n'est pas le nombre d'interruptions reçues mais la façon de les gérer et de reprendre le fil du travail.",
    africanExample:
      "Amara, 29 ans, analyste financier en microfinance à Kigali — un système qui a réduit de 50 % son temps de reprise après interruption.",
    errorToAvoid:
      "Traiter chaque interruption en profondeur au moment où elle arrive — le coût réel est la reprise du travail concentré.",
  }),
  exercise: {
    type: "guidedForm",
    prompt: "Mes phrases de signalement et mon rituel de reprise (3 étapes en moins de 2 minutes).",
    feedbackText: "Conseil personnalisé pour rendre votre phrase culturellement adaptée à votre organisation.",
    fields: [
      { label: "Ma phrase de signalement bienveillant", placeholder: "« Je suis sur un dossier important, j'ai besoin de [durée]. Je reviens à [heure]. »", prefillFromMomentAncrage: false },
      { label: "Mon rituel de reprise (3 étapes)", placeholder: "relire · re-focaliser · première micro-action", prefillFromMomentAncrage: false },
    ],
  },
};

const ms15: MicroSession = {
  id: "1.5",
  title: "Construire son temps protégé en contexte africain",
  durationEstimate: "20 min",
  summaryPoints: [
    "Le temps de travail profond est une nécessité, pas un luxe — sa protection demande une ingénierie culturelle.",
    "Système en 4 composantes : négociation ascendante, communication horizontale, indicateur visuel, réciprocité.",
    "Créer ses plages en secret échoue : l'absence de communication est perçue comme de l'arrogance.",
  ],
  video: v({
    title: "Construire son temps protégé en contexte africain",
    durationSec: 360,
    keyMessage:
      "La protection du temps de fond demande une ingénierie culturellement adaptée à son organisation africaine.",
    africanExample:
      "Fatima, 34 ans, responsable RH dans la distribution à Casablanca — 90 minutes protégées chaque matin, négociées et communiquées, ×3 sa production stratégique.",
    errorToAvoid:
      "Créer des plages de travail profond en secret, sans communication à son équipe.",
  }),
  exercise: {
    type: "guidedForm",
    prompt:
      "Mon système de temps protégé adapté aux codes de mon organisation (réutilisé dans l'Application terrain du Bloc 2).",
    feedbackText: "Vos éléments sont sauvegardés et pré-remplis dans l'Application terrain du Bloc 2.",
    fields: [
      { label: "Mon créneau (de … h à … h) et fréquence/semaine", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Ma formulation pour ma hiérarchie", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Ma formulation pour mes collègues", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Mon indicateur visuel + mon geste de réciprocité", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

// --- Bloc 2 micro-sessions (videos 7–9 + exercises) -------------------------

const ms21: MicroSession = {
  id: "2.1",
  title: "Dire non avec élégance dans la hiérarchie africaine",
  durationEstimate: "20 min",
  summaryPoints: [
    "Dire non ne signifie pas refuser mais proposer un « oui différent ».",
    "Technique en 3 temps : accuser réception, exposer le conflit de priorités, proposer deux options datées.",
    "On ne refuse jamais : on manage le choix, ce qui préserve la relation hiérarchique.",
  ],
  video: v({
    title: "Dire non avec élégance dans la hiérarchie africaine",
    durationSec: 300,
    keyMessage:
      "Dire non dans une hiérarchie africaine, c'est proposer un « oui différent » qui préserve la relation tout en protégeant son temps.",
    africanExample:
      "Moussa, 29 ans, assistant de programme dans une ONG à Bamako — la technique du « oui différent » a réduit de 35 % sa charge d'urgences imposées.",
    errorToAvoid:
      "Dire non directement et sans alternative — interprété comme un manque de respect ou d'engagement.",
  }),
  exercise: {
    type: "guidedForm",
    prompt: "Formuler mes « oui différents » pour les 3 situations d'urgence imposée les plus fréquentes.",
    feedbackText: "Vérification que chaque formulation accuse réception, expose le conflit et propose une alternative datée.",
    fields: [
      { label: "Demande de rapport urgent de dernière minute → mon « oui différent »", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Réunion non planifiée pendant mon temps de fond → mon « oui différent »", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Demande d'aide d'un collègue sur son dossier → mon « oui différent »", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

const ms22: MicroSession = {
  id: "2.2",
  title: "La planification hebdomadaire dans les réalités africaines",
  durationEstimate: "20 min",
  summaryPoints: [
    "Planifier 3 résultats non négociables (des livrables finis), pas une liste de tâches.",
    "Décider quand les réaliser, en blocs déplaçables — le résultat ne change pas, seul le moment change.",
    "Réserver un « buffer africain » de 30–35 % pour absorber les imprévus.",
  ],
  video: v({
    title: "La planification hebdomadaire dans les réalités africaines",
    durationSec: 300,
    keyMessage:
      "Un cadre flexible de 3 priorités hebdomadaires + buffer, pour savoir quoi protéger et quoi renégocier quand l'imprévu arrive.",
    africanExample:
      "Victorine, 31 ans, chargée de projet à Kinshasa — un rituel de planification de 45 minutes le vendredi, tenu depuis 14 mois dans 4 contextes africains.",
    errorToAvoid:
      "Planifier sa semaine heure par heure en blocs rigides — rompu dès le lundi matin.",
  }),
  exercise: {
    type: "guidedForm",
    prompt: "Ma planification hebdomadaire africaine : 3 résultats attendus, leur créneau, et mon buffer.",
    feedbackText: "Vérification que vos 3 résultats sont des livrables finis et que votre buffer atteint 30–35 %.",
    fields: [
      { label: "Résultat 1 (livrable fini) + créneau", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Résultat 2 (livrable fini) + créneau", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Résultat 3 (livrable fini) + créneau", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Mon buffer africain (% du temps réservé)", placeholder: "30–35 %", prefillFromMomentAncrage: false },
    ],
  },
};

const ms23: MicroSession = {
  id: "2.3",
  title: "Déléguer avec confiance dans les équipes africaines",
  durationEstimate: "20 min",
  summaryPoints: [
    "Déléguer le résultat attendu (livrable + format + délai), pas la méthode.",
    "Signaler la confiance explicitement, ancrée dans un acte passé observable.",
    "Un seul jalon intermédiaire + valoriser le livrable dans l'espace collectif.",
  ],
  video: v({
    title: "Déléguer avec confiance dans les équipes africaines",
    durationSec: 300,
    keyMessage:
      "La délégation africaine repose sur la clarté du résultat, la confiance signalée et un suivi qui accompagne sans micro-manager.",
    africanExample:
      "Kwame, 35 ans, manager logistique à Dar es Salaam — une méthode en 4 étapes qui a doublé la capacité de son équipe et libéré 6 h/semaine.",
    errorToAvoid:
      "Déléguer des instructions de méthode sans résultat attendu — ambiguïté anxiogène et allers-retours coûteux.",
  }),
  exercise: {
    type: "guidedForm",
    prompt: "Ma prochaine délégation : préparez-la avec la méthode de Kwame.",
    feedbackText: "Vérification que le résultat, la confiance signalée, le jalon unique et la valorisation sont présents.",
    fields: [
      { label: "La tâche à déléguer + la personne", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Le résultat attendu (livrable + délai + format)", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Ma phrase de signalement de confiance", placeholder: "…", prefillFromMomentAncrage: false },
      { label: "Mon unique jalon de suivi + comment je valorise le livrable", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

// --- Bloc 3 micro-sessions (videos 10–11) -----------------------------------

const ms31: MicroSession = {
  id: "3.1",
  title: "Construire ses rituels de productivité africaine",
  durationEstimate: "20 min",
  summaryPoints: [
    "Les rituels sont des structures que vous créez pour votre propre liberté — la seule chose stable quand tout change.",
    "Un seul rituel à la fois, 3 semaines minimum avant le suivant (raison neurologique).",
    "3 rituels de Jean-Paul : lancement de journée (10 min), bloc de fond (90 min), clôture (15 min).",
  ],
  video: v({
    title: "Construire ses rituels de productivité africaine",
    durationSec: 360,
    keyMessage:
      "Dans les organisations africaines à forte imprévision, les rituels sont la seule chose qui reste stable quand tout le reste change.",
    africanExample:
      "Jean-Paul, 32 ans, chef de département dans une institution financière à Lomé — 3 rituels installés sur 8 semaines, un à la fois.",
    errorToAvoid:
      "Installer tous ses rituels en même temps — abandon quasi assuré au bout de deux semaines.",
  }),
  exercise: {
    type: "written",
    prompt:
      "Quel rituel de productivité allez-vous installer EN PREMIER dans les 7 prochains jours ? Décrivez le rituel, le moment, la durée et comment vous l'ancrez dans votre réalité africaine. (Ancré dans {{moment_ancrage}}.)",
    feedbackText: "Conseil personnalisé pour séquencer l'installation d'un seul rituel à la fois.",
    minChars: 200,
  },
};

const ms32: MicroSession = {
  id: "3.2",
  title: "Productivité hybride dans les organisations africaines",
  durationEstimate: "30 min",
  summaryPoints: [
    "Adapter ses outils et sa communication selon le mode (présentiel/distanciel) en gardant la dimension relationnelle.",
    "Protocole en 4 composantes : asynchrone d'abord, check-in relationnel, protection de la bande passante humaine, clôture de semaine collective.",
    "Ne pas reproduire en distanciel toutes les habitudes du présentiel africain.",
  ],
  video: v({
    title: "Productivité hybride dans les organisations africaines",
    durationSec: 360,
    keyMessage:
      "La productivité hybride africaine n'est pas la reproduction du présentiel à l'écran — c'est une architecture nouvelle qui préserve la relation et le collectif.",
    africanExample:
      "Un cabinet de conseil panafricain réparti entre Accra et Nairobi — un protocole hybride en 4 composantes qui a restauré la cohésion en 3 mois.",
    errorToAvoid:
      "Reproduire en distanciel les longues réunions informelles du présentiel, sans tenir compte de la charge cognitive et des coûts de connectivité.",
  }),
  exercise: {
    type: "written",
    prompt:
      "Cas transversal Sylvie (Abidjan) : quel diagnostic posez-vous avant tout outil, et quelle première action recommandez-vous à son équipe hybride ?",
    feedbackText:
      "Avant tout outil, identifier si le problème est personnel (méthode), organisationnel (culture) ou systémique (charge). L'outil vient après le diagnostic.",
    minChars: 150,
  },
};

export const n1Full: CourseContent = {
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
  summary:
    "Niveau 1 — Fondamentaux. De « occupé jamais productif » à « je contrôle mon temps dans un environnement africain à forte culture de l'urgence ».",
  objective:
    "À la fin de ce parcours, vous saurez reprendre le contrôle de votre temps dans votre organisation africaine : distinguer l'urgent de l'important, protéger vos priorités réelles, déléguer et dire non avec élégance, et tenir des rituels adaptés à votre réalité. Concrètement, la journée que vous venez de décrire ne se reproduira plus de la même façon.",
  audience:
    "Jeunes professionnels (0–5 ans) dans des organisations africaines, débordés par les interruptions et la culture de l'urgence.",
  durationEstimate: "~7 h 30 à 8 h · 23 micro-sessions",
  passThreshold: 70,
  certificate: {
    title: "Certificat de Niveau 1 — Gestion du Temps & Productivité en Environnements Professionnels Africains",
    openBadges2: true,
    verificationUrlPattern: "verify.declick.kompetences.net/c/{id}",
  },
  blocks: [
    // ===================== BLOC 0 — ONBOARDING & DÉCLENCHEUR =====================
    {
      index: 0,
      type: "ONBOARDING",
      title: "Onboarding & Déclencheur",
      objective: "Créer un engagement personnel immédiat dans les 5 premières minutes via le Moment d'Ancrage et le profil de gestion du temps.",
      durationEstimate: "~25 min · 2 micro-sessions",
      units: [
        { label: "MS 0.1 — Onboarding (Moment d'Ancrage, profil, objectif, pair)", type: "micro-session", durationMin: 10 },
        { label: "MS 0.2 — Déclencheur (Vidéo 1 + quiz)", type: "micro-session", durationMin: 15 },
      ],
      badge: {
        type: "ENTRY",
        label: "Badge d'Entrée",
        conditions: ["Moment d'Ancrage saisi", "Profil de gestion du temps identifié", "Vidéo 1 visionnée", "Quiz déclencheur complété", "Pair de progression nommé"],
      },
      payload: {
        momentAncrage: {
          promptText:
            "En une phrase, décrivez une journée récente dans votre organisation où vous avez travaillé dur mais avez terminé avec le sentiment de ne pas avoir accompli ce qui comptait vraiment — pour vous ou pour votre équipe.",
          minChars: 50,
          placeholderExample:
            "Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé.",
        },
        profileChoices: [
          { key: "A", name: "Le Débordé réactif", description: "Je réponds à tout ce qui arrive dans l'ordre où ça arrive. Je n'ai jamais le temps de planifier — les urgences ne s'arrêtent jamais." },
          { key: "B", name: "Le Procrastinateur organisé", description: "Je sais ce que je dois faire, j'ai des listes — mais je reporte les tâches importantes au profit du facile ou des sollicitations externes." },
          { key: "C", name: "L'Urgentiste chronique", description: "Je ne travaille vraiment qu'en mode urgence maximale. Les deadlines imminentes et la pression de mon manager sont mes seuls moteurs." },
          { key: "D", name: "L'Organisateur submergé", description: "Je planifie, j'ai des outils, des agendas — mais les imprévus et demandes de dernière minute détruisent mes plans en permanence." },
        ],
        triggerVideo: v({
          title: "Occupé ou productif ? Ce que les meilleures organisations africaines ont compris",
          durationSec: 600,
          keyMessage:
            "La vraie productivité n'est pas de travailler plus — c'est de récupérer le contrôle de son temps dans un environnement qui tire en permanence dans tous les sens.",
          africanExample:
            "Adjoua, 26 ans, assistante marketing à Abidjan (de débordée à maîtrisée en 3 mois) ; Thierno, 32 ans, chargé de projets en ONG à Dakar (compétent mais épuisé, jamais à jour).",
          errorToAvoid:
            "Confondre occupation et productivité — la personne la plus occupée et disponible n'est pas la plus productive, souvent la plus exploitée.",
        }),
        triggerQuiz: {
          questions: [
            {
              id: "t1",
              text: "À quelle fréquence terminez-vous votre journée avec le sentiment d'avoir accompli ce qui était vraiment prioritaire ?",
              options: [
                { key: "A", label: "Rarement ou jamais — les urgences ont tout pris." },
                { key: "B", label: "Parfois — les bonnes semaines." },
                { key: "C", label: "Souvent — j'ai une méthode qui tient." },
                { key: "D", label: "Toujours — je contrôle mon agenda." },
              ],
            },
            {
              id: "t2",
              text: "Combien de fois par jour êtes-vous interrompu (WhatsApp, visites, demandes imprévues) ?",
              options: [
                { key: "A", label: "Moins de 5 fois." },
                { key: "B", label: "Entre 5 et 15 fois." },
                { key: "C", label: "Entre 15 et 30 fois." },
                { key: "D", label: "Plus de 30 fois." },
              ],
            },
            {
              id: "t3",
              text: "Quand votre supérieur vous demande quelque chose de non urgent qui perturbe votre travail, comment réagissez-vous ?",
              options: [
                { key: "A", label: "J'arrête tout et traite sa demande." },
                { key: "B", label: "Je demande un délai en expliquant sur quoi je travaille." },
                { key: "C", label: "Je traite dès que possible mais finis ma tâche en cours." },
                { key: "D", label: "Je planifie sa demande et lui confirme quand je la traiterai." },
              ],
            },
            {
              id: "t4",
              text: "Avez-vous une méthode régulière de planification de votre semaine ?",
              options: [
                { key: "A", label: "Oui — une routine hebdomadaire suivie." },
                { key: "B", label: "En partie — parfois, pas systématiquement." },
                { key: "C", label: "Rarement — je réagis plutôt que j'anticipe." },
                { key: "D", label: "Non — pas de système en place." },
              ],
            },
            {
              id: "t5",
              text: "Principale raison pour laquelle vous n'accomplissez pas assez vos priorités réelles ?",
              options: [
                { key: "A", label: "Les interruptions et demandes imprévues prennent tout." },
                { key: "B", label: "Je ne distingue pas mes vraies priorités des urgences imposées." },
                { key: "C", label: "J'ai du mal à dire non dans ma culture professionnelle." },
                { key: "D", label: "Je manque de méthode et de rituels efficaces." },
              ],
            },
          ],
        },
        progressPeer: { mandatory: true },
      },
    },

    // ===================== BLOC 1 — COMPRENDRE =====================
    {
      index: 1,
      type: "COMPREHENSION",
      title: "Comprendre les dynamiques du temps en contexte africain",
      objective: "Identifier les mécanismes qui détruisent la productivité, comprendre sa relation au temps, poser les bases d'une gestion du temps adaptée.",
      durationEstimate: "~2 h · 7 micro-sessions",
      units: [
        { label: "MS 1.0 — Quiz diagnostique", type: "micro-session", durationMin: 15 },
        { label: "MS 1.1 — Vidéo 2 + micro-exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 1.2 — Vidéo 3 + micro-exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 1.3 — Vidéo 4 + micro-exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 1.4 — Vidéo 5 + micro-exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 1.5 — Vidéo 6 + micro-exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 1.6 — Étude de cas Nadia", type: "micro-session", durationMin: 25 },
      ],
      badge: {
        type: "COMPREHENSION",
        label: "Badge Compréhension",
        conditions: ["Quiz diagnostique complété", "5 micro-exercices (1.1–1.5) faits", "Étude de cas Nadia complétée"],
      },
      payload: {
        diagnosticQuiz: {
          questions: [
            { id: "d1", scenarioText: "Message WhatsApp du manager à 16h45 : rapport synthèse « urgent » pour demain 8h, alors que vous traitez un dossier prioritaire pour vendredi.", options: [
              { key: "A", label: "J'arrête mon dossier et commence le rapport — urgent = urgent." },
              { key: "B", label: "Je confirme la réception, évalue la faisabilité et propose un choix de priorisation." },
              { key: "C", label: "Je termine ma tâche et commence le rapport tôt le lendemain." },
              { key: "D", label: "Je demande à un collègue de prendre le rapport." },
            ], correctKey: "B", feedbackText: "Beaucoup d'urgences déclarées ne le sont pas. Confirmer, évaluer et proposer un choix rend le contrôle au manager — c'est du professionnalisme.", subArea: "urgences imposées" },
            { id: "d2", scenarioText: "2 h de travail concentré prévues ce mardi matin. À 9h15 un collègue entre pour un sujet non urgent.", options: [
              { key: "A", label: "Je l'écoute entièrement — refuser est délicat culturellement." },
              { key: "B", label: "Je lui dis que je n'ai pas le temps, qu'il revienne plus tard." },
              { key: "C", label: "Je lui accorde 5 min, note son sujet et fixe un moment précis." },
              { key: "D", label: "Je continue à travailler tout en l'écoutant." },
            ], correctKey: "C", feedbackText: "C respecte les codes relationnels tout en protégeant le focus ; fixer un moment précis montre que vous prenez sa demande au sérieux.", subArea: "interruptions" },
            { id: "d3", scenarioText: "Liste de 12 tâches, il est 8h30. Que faites-vous en premier ?", options: [
              { key: "A", label: "Les tâches faciles et courtes pour décocher vite." },
              { key: "B", label: "Les emails et WhatsApp de la veille." },
              { key: "C", label: "La tâche la plus importante (pas la plus urgente), avant les messages." },
              { key: "D", label: "Répartir les 12 tâches en blocs d'une heure." },
            ], correctKey: "C", feedbackText: "Commencer par le facile crée l'illusion de productivité. La tâche la plus importante mérite les premières heures.", subArea: "priorisation" },
            { id: "d4", scenarioText: "Organisation gabonaise à réunions fréquentes non planifiées. Convoqué 2 h alors que vous deviez finaliser un dossier.", options: [
              { key: "A", label: "J'assiste entièrement — manquer une réunion est trop risqué." },
              { key: "B", label: "Je demande l'ordre du jour et négocie ma présence partielle." },
              { key: "C", label: "J'y vais mais travaille discrètement sur mon dossier." },
              { key: "D", label: "J'accepte et renégocie en amont mon dossier avec la partie prenante." },
            ], correctKey: "D", feedbackText: "D permet d'assister (respect de la hiérarchie) tout en gérant activement l'impact ; renégocier en amont est plus professionnel.", subArea: "réunions" },
            { id: "d5", scenarioText: "Vendredi 17h30, tâche importante à 60 % (45 min pour finir), départ prévu à 18h.", options: [
              { key: "A", label: "Je reste finir — une tâche non terminée est non faite." },
              { key: "B", label: "Je documente précisément l'état (60 %, prochaines étapes) et pars à 18h." },
              { key: "C", label: "Je pars et reviens samedi matin." },
              { key: "D", label: "J'essaie de finir en 20 min en allant moins dans le détail." },
            ], correctKey: "B", feedbackText: "La fatigue de fin de semaine produit rarement de la qualité ; documenter précisément permet de reprendre efficacement lundi.", subArea: "présentéisme" },
            { id: "d6", scenarioText: "Plages de concentration communiquées depuis 2 semaines. Un collègue : « Tu n'es jamais disponible ces derniers temps. »", options: [
              { key: "A", label: "J'arrête la méthode — la disponibilité est fondamentale." },
              { key: "B", label: "J'ignore — ma productivité prime." },
              { key: "C", label: "J'explique mes plages, reste accessible aux urgences réelles et montre comment me joindre." },
              { key: "D", label: "J'alterne une heure de focus et une heure de disponibilité totale." },
            ], correctKey: "C", feedbackText: "La disponibilité relationnelle peut coexister avec une gestion structurée si elle est clairement communiquée — intelligence culturelle appliquée.", subArea: "communication" },
            { id: "d7", scenarioText: "≈ 80 messages WhatsApp pro/jour, de 6h à 23h. Quelle stratégie ?", options: [
              { key: "A", label: "Je coupe toutes les notifications et consulte 2 fois/jour." },
              { key: "B", label: "Je réponds à tout dans les 30 min, quelle que soit l'heure." },
              { key: "C", label: "3 plages de consultation communiquées + notifications pour un groupe « urgences réelles »." },
              { key: "D", label: "Je réponds tout de suite au manager et diffère les autres." },
            ], correctKey: "C", feedbackText: "Disparaître totalement (A) est perçu comme de l'arrogance. C équilibre protection du focus et canal d'urgence identifié.", subArea: "WhatsApp" },
            { id: "d8", scenarioText: "Déléguer une tâche à un junior ghanéen alors que vous avez tendance à tout faire vous-même.", options: [
              { key: "A", label: "Je délègue avec instructions très détaillées et vérifie chaque heure." },
              { key: "B", label: "Je garde la tâche — déléguer prend plus de temps." },
              { key: "C", label: "Je clarifie le résultat, les ressources et les jalons, puis je laisse travailler en restant dispo." },
              { key: "D", label: "Je fais la tâche moi-même et le junior m'observe." },
            ], correctKey: "C", feedbackText: "Déléguer le résultat (pas la méthode), donner les ressources et des jalons sans micro-management libère votre temps et développe le junior.", subArea: "délégation" },
            { id: "d9", scenarioText: "Projet camerounais en retard de 3 semaines. Le manager demande de travailler les weekends pendant un mois ; vous êtes déjà à charge maximale.", options: [
              { key: "A", label: "J'accepte sans discuter." },
              { key: "B", label: "Je refuse directement — pas dans mon contrat." },
              { key: "C", label: "Je demande un temps de réflexion, analyse la cause du retard et propose un plan avec plusieurs options." },
              { key: "D", label: "Je négocie 2 weekends au lieu d'un mois." },
            ], correctKey: "C", feedbackText: "C déplace la conversation du « comment » au « quoi » ; proposer un plan alternatif démontre la maîtrise tout en protégeant l'énergie.", subArea: "négociation" },
            { id: "d10", scenarioText: "En repensant à votre semaine, quelle phrase vous ressemble le plus ?", options: [
              { key: "A", label: "Épuisé mais satisfait — j'ai accompli ce qui comptait." },
              { key: "B", label: "Épuisé et frustré — les urgences des autres ont pris la place de mes priorités." },
              { key: "C", label: "Une liste de choses non faites et un sentiment de retard permanent." },
              { key: "D", label: "Une certaine maîtrise — une méthode à affiner." },
            ], correctKey: "B", feedbackText: "Toutes les réponses révèlent un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). Aucune n'est « mauvaise ».", subArea: "auto-positionnement" },
          ],
          profiles: [
            { scoreRange: [8, 10], name: "Productif maîtrisé", description: "Bons réflexes déjà là. Priorité : techniques avancées de protection du temps de fond et de délégation." },
            { scoreRange: [5, 7], name: "Organisateur en transition", description: "Des méthodes mais débordées par les imprévus. Priorité : filtrage des urgences et récupération de temps." },
            { scoreRange: [3, 4], name: "Réactif conscient", description: "Vous savez que vous pourriez faire mieux. Priorité : premiers rituels et distinction urgence/importance." },
            { scoreRange: [0, 2], name: "Réactif en éveil", description: "Prise de conscience récente. Ce parcours est entièrement fait pour vous." },
          ],
        },
        microSessions: [ms11, ms12, ms13, ms14, ms15],
        caseStudy: {
          title: "Nadia : compétente, épuisée, prisonnière de ses propres réponses aux urgences (Nairobi)",
          steps: [
            "Étape 1 — Analyser : profil dominant de Nadia (Débordé réactif) et cause racine (avoir confondu « être disponible » et « être productive »).",
            "Étape 2 — Plan d'action : point de fin de journée à 17h30 ; créneaux de disponibilité + boîte de demandes écrites ; négociation ascendante d'un créneau de concentration matinal.",
            "Étape 3 — Transfert personnel : en quoi la situation de Nadia ressemble à votre Moment d'Ancrage (réponse sauvegardée pour le Bloc 4) ; le réflexe du Bloc 1 à appliquer dès cette semaine.",
          ],
        },
      },
    },

    // ===================== BLOC 2 — PRATIQUER =====================
    {
      index: 2,
      type: "PRACTICE",
      title: "Pratiquer et progresser",
      objective: "Mettre en pratique les outils dans des situations africaines réalistes, en tenant compte des codes culturels et des dynamiques hiérarchiques.",
      durationEstimate: "~2 h à 2 h 30 · 3 micro-sessions + 2 activités longues",
      units: [
        { label: "MS 2.1 — Vidéo 7 + exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 2.2 — Vidéo 8 + exercice", type: "micro-session", durationMin: 20 },
        { label: "MS 2.3 — Vidéo 9 + exercice", type: "micro-session", durationMin: 20 },
        { label: "Mises en situation guidées + quiz interbloc", type: "long-activity", durationMin: 40 },
        { label: "Application terrain (obligatoire)", type: "long-activity", durationMin: 35 },
      ],
      badge: {
        type: "PRACTICE",
        label: "Badge Pratique",
        conditions: ["3 vidéos + exercices (2.1–2.3)", "Mises en situation guidées complétées", "Quiz interbloc fait", "Application terrain soumise"],
      },
      payload: {
        microSessions: [ms21, ms22, ms23],
        guidedScenarios: [
          {
            title: "Prioriser sous pression — institution de microfinance à Dakar (Sénégal)",
            contextAfricain: "Lundi 8h30, 3 échéances cette semaine ; le directeur convoque une réunion non planifiée dans 30 minutes.",
            steps: [
              { question: "Avant la réunion non planifiée, que faites-vous de vos 30 minutes ?", options: [
                { key: "A", label: "Je relis les dossiers en cours pour être prêt." },
                { key: "B", label: "J'envoie un email pour déléguer la relance des 12 clients." },
                { key: "C", label: "Je note mes 3 échéances, identifie la plus critique et planifie leurs créneaux." },
                { key: "D", label: "J'attends de savoir ce que veut le directeur." },
              ], correctKey: "C", feedback: "Planifier explicitement avant la perturbation crée un « ancrage de semaine » pour revenir à ses priorités après la réunion." },
              { question: "En réunion, le directeur demande « en urgence » une analyse concurrentielle pour mercredi. Que faites-vous ?", options: [
                { key: "A", label: "J'accepte et l'ajoute à ma semaine déjà chargée." },
                { key: "B", label: "J'accepte mais signale le conflit et demande quelle échéance réorganiser." },
                { key: "C", label: "Je demande une semaine de délai." },
                { key: "D", label: "Je délègue sans en parler au directeur." },
              ], correctKey: "B", feedback: "Accepter sans refuser tout en rendant visible le conflit donne au directeur les informations pour décider — intelligence managériale." },
            ],
          },
          {
            title: "Protéger son temps de fond — startup fintech à Accra (Ghana)",
            contextAfricain: "Équipe de 8 sur WhatsApp, ≈ 65 messages/jour, fondateur qui valorise la réactivité ; projet à remettre vendredi, on est mercredi.",
            steps: [
              { question: "Pour bloquer 3 h de focus, comment gérez-vous la pression WhatsApp du fondateur ?", options: [
                { key: "A", label: "Je reste disponible toute la journée." },
                { key: "B", label: "J'informe le fondateur d'une plage 9h–12h moins réactive, avec accès d'urgence par appel, puis je coupe les notifications." },
                { key: "C", label: "J'attends son départ en réunion pour couper discrètement." },
                { key: "D", label: "Je travaille depuis un café." },
              ], correctKey: "B", feedback: "Informer avant d'agir crée un contrat explicite qui protège le temps sans sacrifier la relation." },
              { question: "À 10h30, un collègue : « besoin de ton input sur la slide 4 pour 11h ». Que faites-vous ?", options: [
                { key: "A", label: "J'interromps mon focus et l'aide immédiatement." },
                { key: "B", label: "J'ignore jusqu'à 12h." },
                { key: "C", label: "Je réponds en 10 s : « focus jusqu'à 12h, avis à 12h05 — ça tient ? » et je reviens au travail." },
                { key: "D", label: "Je lui explique ma méthode par message vocal." },
              ], correctKey: "C", feedback: "10 secondes d'investissement (réponse + alternative datée) pour 90 minutes de protection." },
            ],
          },
          {
            title: "Déléguer sous contrainte — ONG à Yaoundé (Cameroun)",
            contextAfricain: "Vous coordonnez 4 personnes ; 3 semaines de retard sur un rapport stratégique géré seul ; le manager demande pourquoi.",
            steps: [
              { question: "Comment expliquez-vous la situation sans perdre en crédibilité ?", options: [
                { key: "A", label: "J'invente une raison externe (données indisponibles)." },
                { key: "B", label: "Je reconnais avoir voulu tout gérer seul et propose 2 sections à déléguer + une date de livraison." },
                { key: "C", label: "Je minimise et promets « bientôt »." },
                { key: "D", label: "Je demande une extension sans raison." },
              ], correctKey: "B", feedback: "L'honnêteté avec un plan de récupération concret est la plus respectée dans les hiérarchies africaines." },
              { question: "Le junior remet un draft très en-dessous du niveau attendu. Comment réagissez-vous ?", options: [
                { key: "A", label: "Je reprends le travail moi-même." },
                { key: "B", label: "Je remets le draft avec des commentaires écrits et laisse corriger seul." },
                { key: "C", label: "Je planifie 30 min pour revoir ensemble et convenir d'une v2 sous 48h." },
                { key: "D", label: "Je signale l'échec au manager pour me couvrir." },
              ], correctKey: "C", feedback: "La délégation africaine efficace inclut le coaching du premier essai ; 30 min investies développent le junior et préservent la qualité." },
            ],
          },
        ],
        interBlockQuiz: {
          title: "Quiz interbloc — consolidation des Blocs 1 et 2",
          scored: false,
          questions: [
            { id: "ib1", scenarioText: "Votre manager rwandais envoie un message à 20h avec « pour info ». Le lendemain il demande si vous l'avez vu. Que signifie « pour info » ici ?", options: [
              { key: "A", label: "Aucune action attendue, c'était juste informatif." },
              { key: "B", label: "Il attend une confirmation de lecture dans la soirée." },
              { key: "C", label: "Souvent une demande implicite — une brève confirmation est socialement attendue." },
              { key: "D", label: "Attendre qu'il précise explicitement ce qu'il attend." },
            ], correctKey: "C", feedbackText: "« Pour info » signifie souvent « j'aimerais une réaction » sans le formuler ; lire les codes implicites est une compétence de navigation organisationnelle africaine.", subArea: "implicite" },
            { id: "ib2", scenarioText: "5 tâches lundi matin à Abidjan. Par laquelle commencez-vous selon la méthode du parcours ?", options: [
              { key: "A", label: "La plus courte pour une bonne dynamique." },
              { key: "B", label: "La plus importante pour ma mission, même difficile." },
              { key: "C", label: "La plus urgente selon mon manager." },
              { key: "D", label: "Celle que j'aime le plus faire." },
            ], correctKey: "B", feedbackText: "Les premières heures sont vos heures d'énergie maximale — c'est là que le vrai travail (important, pas urgent) doit être fait.", subArea: "priorisation" },
            { id: "ib3", scenarioText: "Un collègue senior demande de l'aide pendant votre créneau de concentration communiqué à l'équipe togolaise.", options: [
              { key: "A", label: "Je l'aide immédiatement — un senior ne peut pas attendre." },
              { key: "B", label: "Je l'ignore jusqu'à la fin de mon créneau." },
              { key: "C", label: "Je signale mon créneau et propose de l'aider à une heure précise." },
              { key: "D", label: "J'abandonne mon créneau et travaille le soir." },
            ], correctKey: "C", feedbackText: "Maintenir le créneau tout en proposant une alternative concrète est l'équilibre culturel clé.", subArea: "interruptions" },
            { id: "ib4", scenarioText: "Vous planifiez votre semaine en RDC avec coupures d'électricité et embouteillages réguliers. Quelle est la règle d'or ?", options: [
              { key: "A", label: "Planifier toutes mes heures pour ne pas perdre de temps." },
              { key: "B", label: "Réserver 30 à 40 % de buffer africain pour les imprévus réels." },
              { key: "C", label: "Ne planifier que le matin." },
              { key: "D", label: "Ne pas planifier et m'adapter au jour le jour." },
            ], correctKey: "B", feedbackText: "Le buffer africain est non négociable : planifier 100 % de son temps garantit l'échec de la planification.", subArea: "planification" },
            { id: "ib5", scenarioText: "Vous avez délégué à un junior nigérian ; il ne répond pas à votre email de suivi depuis 2 jours.", options: [
              { key: "A", label: "Je reprends la tâche moi-même." },
              { key: "B", label: "J'escalade à mon propre manager." },
              { key: "C", label: "J'envoie un 2e email plus ferme en copiant son manager." },
              { key: "D", label: "Je le contacte directement (appel/face à face) pour comprendre et lever les blocages." },
            ], correctKey: "D", feedbackText: "Dans les cultures à forte communication orale, un junior qui ne répond pas est souvent bloqué ; un contact direct débloque et préserve la relation.", subArea: "délégation" },
            { id: "ib6", scenarioText: "Votre semaine tanzanienne a été désorganisée par 4 urgences imprévues. Vendredi soir, que faites-vous ?", options: [
              { key: "A", label: "Je reste au bureau pour rattraper le retard." },
              { key: "B", label: "Je récupère physiquement, je rattraperai la semaine prochaine." },
              { key: "C", label: "Je passe 20 min à noter les 3 résultats non accomplis et à les planifier, puis je pars." },
              { key: "D", label: "J'envoie un email à mon manager pour signaler la perturbation." },
            ], correctKey: "C", feedbackText: "Le rituel du vendredi : 20 minutes de planification maintenant valent 3 heures de confusion lundi matin.", subArea: "rituels" },
          ],
        },
        fieldApplication: {
          brief:
            "Application terrain (obligatoire pour accéder au Bloc 3) : dans votre environnement professionnel africain réel, en repartant de {{moment_ancrage}}, identifiez votre principal problème de productivité, mettez en œuvre une solution concrète (système de temps protégé, phrase de signalement, « oui différent »), puis documentez la réaction de votre organisation et ce que vous ajustez.",
          minChars: 200,
          gatesNextBlock: true,
        },
      },
    },

    // ===================== BLOC 3 — INSTALLER DES HABITUDES =====================
    {
      index: 3,
      type: "ANCHORING",
      title: "Installer des habitudes durables",
      objective: "Ancrer des habitudes durables adaptées aux réalités africaines, mesurer sa progression et finaliser un plan d'action de 30 jours.",
      durationEstimate: "~1 h 30 · 3 micro-sessions + 1 activité longue",
      units: [
        { label: "MS 3.1 — Vidéo 10 + auto-évaluation", type: "micro-session", durationMin: 20 },
        { label: "Vidéo 11 + cas transversal de synthèse", type: "long-activity", durationMin: 30 },
        { label: "MS 3.3 — Plan d'action 30 jours", type: "micro-session", durationMin: 20 },
        { label: "MS 3.4 — Quiz final (noté · seuil 70 %)", type: "micro-session", durationMin: 15 },
      ],
      badge: {
        type: "ANCHORING",
        label: "Badge Ancrage",
        conditions: ["Vidéos 10–11 + exercices", "Auto-évaluation 6 critères", "Cas Sylvie complété", "Plan d'action 30 j soumis", "Quiz final ≥ 70 %"],
      },
      payload: {
        microSessions: [ms31, ms32],
        selfAssessment: {
          criteria: [
            "Je distingue les urgences réelles des urgences imposées dans mon organisation africaine",
            "Je protège régulièrement du temps de fond pour mes priorités importantes",
            "Je gère les interruptions sans rejeter mes collègues africains",
            "Je planifie ma semaine avec un buffer pour les imprévus africains",
            "Je délègue efficacement en adaptant ma méthode aux codes culturels africains",
            "Je termine mes semaines avec le sentiment d'avoir accompli ce qui comptait vraiment",
          ],
          scale: ["1 — Pas encore", "2 — En cours d'installation", "3 — Souvent présent", "4 — Naturel et constant"],
        },
        actionPlan30d: {
          habits: [
            { title: "Habitude 1 (semaines 1–3) — installée en premier", fields: ["Le rituel", "Le moment", "La durée", "Comment je l'ancre dans ma réalité africaine"] },
            { title: "Habitude 2 (semaines 3–5) — après stabilisation de la 1re", fields: ["Le rituel", "Le moment", "La durée", "Mon signal de concentration"] },
            { title: "Habitude 3 (semaines 5–8) — séquencée en dernier", fields: ["Le rituel", "Le moment", "La durée", "Rappel à mon pair de progression"] },
          ],
        },
        finalQuiz: {
          questions: [
            { id: "f1", scenarioText: "Lundi 8h, organisation sénégalaise, 8 tâches dont 3 « urgentes » (collègues) et 2 importantes (mission). Par laquelle commencez-vous ?", options: [
              { key: "A", label: "La plus facile pour démarrer." },
              { key: "B", label: "La plus importante pour ma mission, même difficile et non urgente." },
              { key: "C", label: "Une des 3 « urgentes »." },
              { key: "D", label: "Je consulte d'abord emails et WhatsApp." },
            ], correctKey: "B", feedbackText: "La priorité la plus importante mérite les premières heures de la semaine ; les urgences des collègues attendent généralement 2 h sans conséquence." },
            { id: "f2", scenarioText: "Directrice ghanéenne à 21h30 : rapport mensuel pour demain 8h au lieu de vendredi ; il est à 60 %.", options: [
              { key: "A", label: "Je travaille toute la nuit pour finir à 100 %." },
              { key: "B", label: "Je finis en 2 h et envoie à 23h30." },
              { key: "C", label: "Je propose une version préliminaire à 8h et la finale vendredi comme prévu." },
              { key: "D", label: "J'ignore jusqu'au matin." },
            ], correctKey: "C", feedbackText: "Le « oui différent » appliqué aux urgences nocturnes : répond au besoin immédiat tout en protégeant la qualité de la livraison finale." },
            { id: "f3", scenarioText: "Un collègue entre pendant votre créneau de focus communiqué à l'équipe togolaise.", options: [
              { key: "A", label: "J'interromps et traite sa demande." },
              { key: "B", label: "Je signale mon créneau et propose un moment précis dans l'heure." },
              { key: "C", label: "Je continue sans le regarder." },
              { key: "D", label: "Je lui dis de revenir vendredi." },
            ], correctKey: "B", feedbackText: "Signaler le créneau + proposer une alternative concrète : maintenir le focus et préserver la relation." },
            { id: "f4", scenarioText: "Semaine de 45 h, organisation nigériane. Combien d'heures max en tâches concrètes ?", options: [
              { key: "A", label: "45 h — tout le temps disponible." },
              { key: "B", label: "40 h — 5 h pour les urgences mineures." },
              { key: "C", label: "≈ 31 h — réserver 30 % de buffer africain." },
              { key: "D", label: "20 h — 3 grandes priorités uniquement." },
            ], correctKey: "C", feedbackText: "Le buffer africain de 30 % (≈ 13,5 h) absorbe les urgences sans détruire les priorités ; 40 h est insuffisant en haute imprévision." },
            { id: "f5", scenarioText: "Junior camerounais : premier draft insuffisant sur une tâche déléguée.", options: [
              { key: "A", label: "Je reprends le travail moi-même." },
              { key: "B", label: "Je planifie 30 min pour revoir, identifier les lacunes et convenir d'une v2 sous 48h." },
              { key: "C", label: "Je renvoie le draft avec des commentaires écrits et j'attends." },
              { key: "D", label: "J'escalade au manager pour me couvrir." },
            ], correctKey: "B", feedbackText: "Un draft insuffisant n'est pas un échec de la délégation : 30 min de coaching forment le junior et maintiennent la qualité." },
            { id: "f6", scenarioText: "Vous abandonnez votre rituel de planification chaque vendredi « parce que trop à faire » (organisation kényane).", options: [
              { key: "A", label: "Je manque de discipline." },
              { key: "B", label: "Le créneau est mauvais — le vendredi épuisé ne marche pas ; essayer jeudi 16h ou vendredi 14h." },
              { key: "C", label: "La planification ne marche pas en contexte africain." },
              { key: "D", label: "Ma charge est réellement trop élevée." },
            ], correctKey: "B", feedbackText: "Si vous abandonnez toujours au même moment, ce moment ne fonctionne pas. Déplacer le rituel vers un moment de moindre épuisement suffit souvent." },
            { id: "f7", scenarioText: "Le manager confie une présentation « pour vendredi » ; on est lundi, vous avez déjà 3 priorités. Première action ?", options: [
              { key: "A", label: "Demander 10 min pour clarifier contenu, durée, format et heure précise de remise." },
              { key: "B", label: "Commencer la présentation immédiatement." },
              { key: "C", label: "Ajouter la tâche et la planifier jeudi." },
              { key: "D", label: "Déléguer à un junior." },
            ], correctKey: "A", feedbackText: "Clarifier avant d'exécuter évite de refaire ; 10 min de clarification peuvent éviter 3 h de travail dans le mauvais sens." },
            { id: "f8", scenarioText: "Votre semaine planifiée est désorganisée par 3 urgences imprévues majeures. Que signifie-t-elle pour votre système ?", options: [
              { key: "A", label: "Mon système ne marche pas — en changer." },
              { key: "B", label: "Mon buffer était insuffisant — l'augmenter à 35–40 % et analyser si ces urgences étaient anticipables." },
              { key: "C", label: "Les imprévus sont une fatalité." },
              { key: "D", label: "J'ai besoin d'un assistant pour filtrer." },
            ], correctKey: "B", feedbackText: "3 urgences non absorbées signalent un buffer trop faible ; beaucoup d'« imprévus » africains sont en réalité récurrents et anticipables." },
          ],
          passThreshold: 70,
        },
      },
    },

    // ===================== BLOC 4 — MINI-PROJET CERTIFIANT =====================
    {
      index: 4,
      type: "CERTIFICATION",
      title: "Mini-projet d'application certifiant",
      objective: "Démontrer l'acquisition des fondamentaux en appliquant les apprentissages à une situation réelle dans son contexte professionnel africain.",
      durationEstimate: "~1 h 30 · 4 micro-sessions + 1 activité longue (6 micro-tâches)",
      units: [
        { label: "MS 4.1 — Section 1 : description de la situation", type: "micro-session", durationMin: 15 },
        { label: "MS 4.2 — Section 2 : solution mise en œuvre", type: "micro-session", durationMin: 15 },
        { label: "MS 4.3 — Section 3 : résultat observé", type: "micro-session", durationMin: 15 },
        { label: "MS 4.4 — Section 4 : apprentissage personnel", type: "micro-session", durationMin: 15 },
        { label: "Journal de pratique (2 semaines)", type: "long-activity", durationMin: 30 },
        { label: "Journal J+1", type: "micro-task", durationMin: 5 },
        { label: "Journal J+3", type: "micro-task", durationMin: 5 },
        { label: "Journal J+5", type: "micro-task", durationMin: 5 },
        { label: "Journal J+7", type: "micro-task", durationMin: 5 },
        { label: "Journal J+10", type: "micro-task", durationMin: 5 },
        { label: "Journal J+14", type: "micro-task", durationMin: 5 },
      ],
      badge: {
        type: "CERTIFICATE",
        label: "Certificat de Niveau 1",
        conditions: ["5 sections soumises", "6 micro-entrées de journal complétées", "Grille D4 ≥ 70/100 validée par un évaluateur"],
      },
      payload: {
        projectBrief:
          "Identifier le principal problème de gestion du temps dans votre environnement professionnel africain réel — en repartant de {{moment_ancrage}} — mettre en œuvre une solution concrète adaptée aux codes culturels de votre organisation, et documenter l'impact observé sur votre productivité et votre bien-être sur 14 jours.",
        sections: [
          { title: "Section 1 — Description de la situation (~10 lignes)", helpText: "Pré-rempli depuis votre Moment d'Ancrage et l'Application terrain du Bloc 2 : contexte africain précis (pays, secteur, organisation), votre rôle, le problème, ses causes et son impact.", prefillFromMomentAncrage: true },
          { title: "Section 2 — La solution mise en œuvre", helpText: "Outil principal, espace de mise en œuvre (formel/informel), adaptation culturelle africaine réalisée.", prefillFromMomentAncrage: false },
          { title: "Section 3 — Résultat observé", helpText: "Impact sur votre productivité (concret, chiffré si possible) ; ce que vous avez appris sur les codes africains de gestion du temps.", prefillFromMomentAncrage: false },
          { title: "Section 4 — Journal des 2 semaines (6 micro-entrées)", helpText: "Les 6 micro-entrées poussées automatiquement (J+1 → J+14).", prefillFromMomentAncrage: false },
          { title: "Section 5 — Apprentissage personnel", helpText: "Ce que vous avez compris sur votre relation au temps ; l'obstacle culturel surmonté ; 3 prochaines occasions de reprendre le contrôle.", prefillFromMomentAncrage: false },
        ],
        journal: {
          // Every journal prompt re-injects the Moment d'Ancrage (Pilier 5.1).
          entries: [
            { day: 1, prompt: "Vous aviez décrit {{moment_ancrage}}. Vous avez commencé votre solution : décrivez en 2-3 lignes la première réaction concrète de votre environnement africain — verbale, comportementale ou intérieure.", minWords: 50 },
            { day: 3, prompt: "Vous aviez décrit {{moment_ancrage}}. Quel obstacle africain réel avez-vous rencontré ? Comment l'avez-vous géré, ou comment allez-vous le gérer dans les prochains jours ?", minWords: 50 },
            { day: 5, prompt: "Au regard de {{moment_ancrage}}, avez-vous observé un changement dans votre façon de répondre aux sollicitations depuis le début ? Donnez un exemple concret.", minWords: 50 },
            { day: 7, prompt: "Vous aviez commencé ce parcours pour traiter {{moment_ancrage}}. Qu'avez-vous partagé avec votre pair de progression, et quelle a été sa perspective sur votre démarche ?", minWords: 50 },
            { day: 10, prompt: "En repartant de {{moment_ancrage}}, quelle est la micro-victoire de productivité africaine la plus significative de ces 10 premiers jours ? Soyez précis et concret.", minWords: 50 },
            { day: 14, prompt: "Par rapport à {{moment_ancrage}}, ce que ce parcours a transformé dans votre relation au temps, et les 3 prochaines occasions de reprendre du contrôle que vous avez identifiées.", minWords: 50 },
          ],
        },
        rubric: {
          // Updated KOMPETENCES AFRICA D4 referential (6 criteria, /100, threshold 70).
          criteria: [
            { label: "Organisation personnelle", competencyCode: "D4.C1", weightPoints: 20 },
            { label: "Gestion des priorités", competencyCode: "D4.C2", weightPoints: 20 },
            { label: "Gestion du temps & interruptions", competencyCode: "D4.C3", weightPoints: 20 },
            { label: "Performance durable + journal", competencyCode: "D4.C4", weightPoints: 15 },
            { label: "Ancrage culturel africain (transversal)", competencyCode: "", weightPoints: 10 },
            { label: "Profondeur de l'apprentissage (transversal)", competencyCode: "", weightPoints: 15 },
          ],
          totalPoints: 100,
          threshold: 70,
        },
        evaluation: { humanEvaluator: true, turnaroundDays: 5, adminAlertAtDay: 5 },
      },
    },
  ],
};
