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
  durationEstimate: "10 min",
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
      "Lisez votre cartographie : additionnez demandes non planifiées + réunions — c'est votre temps subi. Au-delà de 40 %, votre journée appartient aux autres : c'est le premier chiffre à faire baisser. Un travail de fond sous 50 % signale que vos priorités réelles passent après les urgences des autres. Vos % cibles sont désormais votre contrat personnel — la suite du bloc vous donne la matrice pour les atteindre, et votre voleur de temps n° 1 sera votre premier chantier.",
    fields: [
      { label: "Demandes non planifiées (messages, visites, appels) — % de mon temps réel", placeholder: "ex. 25 %", prefillFromMomentAncrage: false },
      { label: "Demandes non planifiées — le changer ? (oui / non)", placeholder: "oui / non", prefillFromMomentAncrage: false },
      { label: "Demandes non planifiées — % cible (« — » si non)", placeholder: "ex. 15 %", prefillFromMomentAncrage: false },
      { label: "Réunions (planifiées et non planifiées) — % de mon temps réel", placeholder: "ex. 15 %", prefillFromMomentAncrage: false },
      { label: "Réunions — le changer ? (oui / non)", placeholder: "oui / non", prefillFromMomentAncrage: false },
      { label: "Réunions — % cible (« — » si non)", placeholder: "ex. 5 %", prefillFromMomentAncrage: false },
      { label: "Travail de fond sur mes priorités réelles — % de mon temps réel", placeholder: "ex. 60 %", prefillFromMomentAncrage: false },
      { label: "Travail de fond — le changer ? (oui / non)", placeholder: "oui / non", prefillFromMomentAncrage: false },
      { label: "Travail de fond — % cible (« — » si non)", placeholder: "ex. 80 %", prefillFromMomentAncrage: false },
      { label: "Mon principal voleur de temps dans mon organisation africaine", placeholder: "…", prefillFromMomentAncrage: false },
    ],
  },
};

const ms12: MicroSession = {
  id: "1.2",
  title: "La matrice des priorités revisitée pour le contexte africain",
  durationEstimate: "10 min",
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
      "Regardez d'abord votre Quadrant 2 : c'est là que se joue votre progression. S'il est vide ou pauvre, vous fonctionnez en mode réactif — bloquez dès cette semaine deux créneaux pour l'une de ces tâches. Si votre Quadrant 3 déborde, appliquez la règle : déléguer, différer avec une date, ou refuser avec une alternative. Le Quadrant 4 se supprime sans négociation. Objectif hebdomadaire : déplacer une tâche du Q3 vers du temps de Q2.",
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
  durationEstimate: "10 min",
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
      "Vérifiez chacune de vos 3 actions avec cette grille : elle est efficace si (1) elle s'attaque au mécanisme, pas à la personne ; (2) elle est faisable sans autorisation de votre hiérarchie ; (3) son effet est observable sous 2 semaines. « Demander aux collègues d'arrêter » échouera ; « proposer un créneau quotidien de traitement des demandes » réussit. Commencez par la source qui revient le plus souvent dans votre semaine — pas par la plus facile.",
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
  durationEstimate: "10 min",
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
    feedbackText:
      "Testez vos phrases : une bonne phrase de signalement (1) accuse réception avec respect, (2) nomme votre créneau en cours, (3) propose un moment précis — « je te reviens à 11h », jamais « plus tard ». Si elle peut être perçue comme un rejet dans votre organisation, ajoutez la marque relationnelle d'usage (salutation, ton, canal). Et votre rituel de reprise doit tenir en 2 minutes : noter où vous en étiez, relire la dernière phrase produite, reprendre — au-delà, vous ne l'utiliserez pas.",
    fields: [
      { label: "Ma phrase de signalement bienveillant", placeholder: "« Je suis sur un dossier important, j'ai besoin de [durée]. Je reviens à [heure]. »", prefillFromMomentAncrage: false },
      { label: "Mon rituel de reprise (3 étapes)", placeholder: "relire · re-focaliser · première micro-action", prefillFromMomentAncrage: false },
    ],
  },
};

const ms15: MicroSession = {
  id: "1.5",
  title: "Construire son temps protégé en contexte africain",
  durationEstimate: "10 min",
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
    feedbackText:
      "Votre système tient si les 3 conditions y sont : un créneau réaliste (60 à 90 min, pas 3 h), négocié AVANT d'être appliqué (votre hiérarchie sait et accepte), et visible (l'équipe sait comment vous joindre en urgence réelle). S'il repose sur la discrétion ou l'isolement, il cassera à la première urgence. Vos éléments sont sauvegardés et pré-remplis dans l'Application terrain du Bloc 2 — vous les testerez en conditions réelles.",
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
  durationEstimate: "10 min",
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
    feedbackText:
      "Relisez chaque formulation avec la grille du « oui différent » : elle doit (1) accuser réception positivement (« oui, je m'en occupe »), (2) rendre visible le conflit de priorités (« j'ai X à livrer pour 16h »), (3) proposer une alternative datée (« je te le fais pour demain 10h — ça convient ? »). Si l'une de vos phrases contient un « non » sec ou reste sans date, reformulez-la : c'est la date qui transforme un refus en engagement.",
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
  durationEstimate: "10 min",
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
    feedbackText:
      "Contrôlez vos 3 résultats : chacun doit être un livrable FINI (« rapport envoyé », pas « avancer sur le rapport »). Puis votre buffer : sur une semaine de 40 h, 30 à 35 % représentent 12 à 14 h non planifiées. Si votre planning occupe plus de 65–70 % du temps, il cassera dès lundi — retirez un résultat plutôt que de rogner le buffer. Enfin, placez les créneaux de vos résultats le matin, aux heures de haute énergie.",
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
  durationEstimate: "10 min",
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
    feedbackText:
      "Votre délégation est prête si les 4 éléments y sont : (1) le RÉSULTAT attendu décrit — pas la méthode ; (2) la confiance exprimée explicitement (« je te confie ça parce que… ») ; (3) UN jalon intermédiaire unique — pas un contrôle chaque heure ; (4) la valorisation prévue à la livraison. S'il manque le jalon, vous découvrirez les problèmes trop tard. Et si vous avez décrit la méthode pas à pas, vous n'avez pas délégué — vous avez dicté.",
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
  durationEstimate: "15 min",
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
    feedbackText:
      "Évaluez votre rituel avec les 4 critères d'installation durable : (1) UN seul rituel — si vous en avez décrit plusieurs, gardez le premier, les autres viendront aux semaines 3 et 5 ; (2) accroché à un déclencheur existant (« après mon café », « en arrivant au bureau ») ; (3) assez petit pour survivre à une mauvaise semaine (15–20 min maximum) ; (4) protégé des imprévus de votre contexte (coupures, transport, sollicitations). Un rituel raté 3 jours de suite n'est pas un échec de volonté : c'est un rituel trop gros — réduisez-le.",
    minChars: 200,
  },
};

const ms32: MicroSession = {
  id: "3.2",
  title: "Vidéo 11 — Productivité hybride dans les organisations africaines",
  durationEstimate: "5 min",
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
  // Vidéo seule : elle enchaîne directement sur le Cas transversal de synthèse
  // (Sylvie à Abidjan), qui porte les questions — voir `transversalCase`.
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
  durationEstimate: "6 h 25 · Bloc 0 20 min · Blocs 1-2 1 h 35 · Bloc 3 1 h 25 · Bloc 4 1 h 30",
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
      durationEstimate: "20 min · 2 micro-sessions",
      units: [
        { label: "MS 0.1 — Onboarding (Moment d'Ancrage, profil, objectif, pair)", type: "micro-session", durationMin: 10 },
        { label: "MS 0.2 — Déclencheur (Vidéo 1 + quiz)", type: "micro-session", durationMin: 10 },
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
        triggerDuration: "10 min",
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
      durationEstimate: "~1 h 35 · 6 micro-sessions + 1 activité longue",
      units: [
        { label: "MS 1.0 — Quiz diagnostique", type: "micro-session", durationMin: 15 },
        { label: "MS 1.1 — Vidéo 2 + micro-exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 1.2 — Vidéo 3 + micro-exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 1.3 — Vidéo 4 + micro-exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 1.4 — Vidéo 5 + micro-exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 1.5 — Vidéo 6 + micro-exercice", type: "micro-session", durationMin: 10 },
        { label: "Étude de cas Nadia (3 étapes)", type: "long-activity", durationMin: 30 },
      ],
      badge: {
        type: "COMPREHENSION",
        label: "Badge Compréhension",
        conditions: ["Quiz diagnostique complété", "5 micro-exercices (1.1–1.5) faits", "Étude de cas Nadia complétée"],
      },
      payload: {
        diagnosticQuiz: {
          title: "Micro-session 1.0 — Quiz diagnostique",
          durationEstimate: "15 min",
          questions: [
            { id: "d1", scenarioText: "Message WhatsApp du manager à 16h45 : rapport synthèse « urgent » pour demain 8h, alors que vous traitez un dossier prioritaire pour vendredi.", options: [
              { key: "A", label: "J'arrête mon dossier et commence le rapport — urgent = urgent." },
              { key: "B", label: "Je confirme la réception, évalue la faisabilité et propose un choix de priorisation." },
              { key: "C", label: "Je termine ma tâche et commence le rapport tôt le lendemain." },
              { key: "D", label: "Je demande à un collègue de prendre le rapport." },
            ], correctKey: "B", feedbackText: "Beaucoup d'urgences déclarées ne le sont pas. Confirmer, évaluer et proposer un choix rend le contrôle au manager — c'est du professionnalisme.", subArea: "urgences imposées" },
            { id: "d2", scenarioText: "2 h de travail concentré prévues ce mardi matin. À 9h15 un collègue entre pour un sujet non urgent.", options: [
              { key: "A", label: "Je lui accorde 5 min, note son sujet et fixe un moment précis." },
              { key: "B", label: "Je lui dis que je n'ai pas le temps, qu'il revienne plus tard." },
              { key: "C", label: "Je l'écoute entièrement — refuser est délicat culturellement." },
              { key: "D", label: "Je continue à travailler tout en l'écoutant." },
            ], correctKey: "A", feedbackText: "Accorder 5 minutes, noter le sujet et fixer un moment précis respecte les codes relationnels tout en protégeant le focus — vous prenez sa demande au sérieux.", subArea: "interruptions" },
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
              { key: "A", label: "J'explique mes plages, reste accessible aux urgences réelles et montre comment me joindre." },
              { key: "B", label: "J'ignore — ma productivité prime." },
              { key: "C", label: "J'arrête la méthode — la disponibilité est fondamentale." },
              { key: "D", label: "J'alterne une heure de focus et une heure de disponibilité totale." },
            ], correctKey: "A", feedbackText: "La disponibilité relationnelle peut coexister avec une gestion structurée si elle est clairement communiquée — intelligence culturelle appliquée.", subArea: "communication" },
            { id: "d7", scenarioText: "≈ 80 messages WhatsApp pro/jour, de 6h à 23h. Quelle stratégie ?", options: [
              { key: "A", label: "Je coupe toutes les notifications et consulte 2 fois/jour." },
              { key: "B", label: "Je réponds à tout dans les 30 min, quelle que soit l'heure." },
              { key: "C", label: "Je réponds tout de suite au manager et diffère les autres." },
              { key: "D", label: "3 plages de consultation communiquées + notifications pour un groupe « urgences réelles »." },
            ], correctKey: "D", feedbackText: "Disparaître totalement (A) est perçu comme de l'arrogance. Les plages de consultation communiquées équilibrent protection du focus et canal d'urgence identifié.", subArea: "WhatsApp" },
            { id: "d8", scenarioText: "Déléguer une tâche à un junior ghanéen alors que vous avez tendance à tout faire vous-même.", options: [
              { key: "A", label: "Je délègue avec instructions très détaillées et vérifie chaque heure." },
              { key: "B", label: "Je garde la tâche — déléguer prend plus de temps." },
              { key: "C", label: "Je clarifie le résultat, les ressources et les jalons, puis je laisse travailler en restant dispo." },
              { key: "D", label: "Je fais la tâche moi-même et le junior m'observe." },
            ], correctKey: "C", feedbackText: "Déléguer le résultat (pas la méthode), donner les ressources et des jalons sans micro-management libère votre temps et développe le junior.", subArea: "délégation" },
            { id: "d9", scenarioText: "Projet camerounais en retard de 3 semaines. Le manager demande de travailler les weekends pendant un mois ; vous êtes déjà à charge maximale.", options: [
              { key: "A", label: "J'accepte sans discuter." },
              { key: "B", label: "Je demande un temps de réflexion, analyse la cause du retard et propose un plan avec plusieurs options." },
              { key: "C", label: "Je refuse directement — pas dans mon contrat." },
              { key: "D", label: "Je négocie 2 weekends au lieu d'un mois." },
            ], correctKey: "B", feedbackText: "Demander un temps de réflexion déplace la conversation du « comment » au « quoi » ; proposer un plan alternatif démontre la maîtrise tout en protégeant l'énergie.", subArea: "négociation" },
            { id: "d10", profiling: true, scenarioText: "En repensant à votre semaine, quelle phrase vous ressemble le plus ?", options: [
              { key: "A", label: "Épuisé mais satisfait — j'ai accompli ce qui comptait." },
              { key: "B", label: "Épuisé et frustré — les urgences des autres ont pris la place de mes priorités." },
              { key: "C", label: "Une liste de choses non faites et un sentiment de retard permanent." },
              { key: "D", label: "Une certaine maîtrise — une méthode à affiner." },
            ], correctKey: "B", feedbackText: "Toutes les réponses révèlent un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). Aucune n'est « mauvaise ».", subArea: "auto-positionnement" },
          ],
          profiles: [
            // NB: the descriptions deliberately avoid the word « priorité » — the
            // per-area learning priorities are listed right below on the result
            // screen, and two competing "priorités" read as an inconsistency.
            { scoreRange: [8, 10], name: "Productif maîtrisé", description: "Bons réflexes déjà là. Pour progresser : techniques avancées de protection du temps de fond et de délégation." },
            { scoreRange: [5, 7], name: "Organisateur en transition", description: "Des méthodes mais débordées par les imprévus. Pour progresser : filtrage des urgences et récupération de temps." },
            { scoreRange: [3, 4], name: "Réactif conscient", description: "Vous savez que vous pourriez faire mieux. Pour progresser : premiers rituels et distinction urgence/importance." },
            { scoreRange: [0, 2], name: "Réactif en éveil", description: "Prise de conscience récente. Ce parcours est entièrement fait pour vous." },
          ],
        },
        microSessions: [ms11, ms12, ms13, ms14, ms15],
        // MICRO-SESSION 1.6 — Étude de cas Nadia (~30 min · LMS natif), énoncé complet.
        caseStudy: {
          title: "Activité longue — Étude de cas",
          subtitle: "Nadia : compétente, épuisée, et prisonnière de ses propres réponses aux urgences",
          durationEstimate: "30 min",
          context:
            "Nadia a 27 ans. Assistante de direction dans une agence de conseil à Nairobi. Depuis 18 mois, elle est devenue la personne à qui tout le monde s'adresse pour tout. Son directeur lui envoie des messages à 7h et à 22h. Ses collègues l'interrompent en moyenne toutes les 20 minutes. Sa liste de tâches propres ne diminue jamais. Elle est épuisée et ne sait pas comment changer sans paraître « moins professionnelle » dans sa culture kényane.",
          steps: [],
          structuredSteps: [
            {
              title: "Étape 1 — Analyser la situation de Nadia",
              durationEstimate: "8 min",
              intro: "",
              questions: [
                { id: "n1.1", kind: "mcq", prompt: "Quel est le profil de gestion du temps dominant de Nadia parmi les quatre profils vus au Bloc 0 ?", options: [
                  { key: "A", label: "Le Débordé réactif — elle répond à tout ce qui arrive dans l'ordre où ça arrive." },
                  { key: "B", label: "Le Procrastinateur organisé — elle reporte ses propres priorités au profit des demandes des autres." },
                  { key: "C", label: "L'Urgentiste chronique — elle n'agit que sous pression maximale." },
                  { key: "D", label: "L'Organisateur submergé — elle planifie mais les imprévus détruisent ses plans." },
                ], correctKey: "A", allValid: false, savedForProject: false,
                  feedback: "Nadia est un Débordé réactif classique. Sa disponibilité totale et sa réputation de fiabilité ont créé un appel d'air — chacun sait qu'il peut compter sur elle, alors chacun vient vers elle. Elle réagit au lieu d'agir. Sa compétence réelle est mise au service des agendas des autres plutôt que des siens." },
                { id: "n1.2", kind: "mcq", prompt: "Quelle est la cause racine de la situation de Nadia ?", options: [
                  { key: "A", label: "Son manager la surcharge délibérément — il faudrait lui parler." },
                  { key: "B", label: "Nadia n'a pas de méthode de gestion du temps — elle a besoin d'un outil." },
                  { key: "C", label: "Nadia a confondu « être disponible » et « être productive » — sa réputation de fiabilité est devenue un piège dont elle n'arrive pas à sortir sans paraître moins professionnelle." },
                  { key: "D", label: "L'organisation kényane valorise trop la disponibilité — c'est une question culturelle qui la dépasse." },
                ], correctKey: "C", allValid: false, savedForProject: false,
                  feedback: "La cause racine est un piège culturel très fréquent : sa disponibilité totale a été valorisée et récompensée par la réputation d'être « fiable ». Sortir de ce piège demande une stratégie culturellement adaptée — pas simplement « faire moins »." },
                { id: "n1.3", kind: "open", prompt: "Réflexion ouverte — En une phrase, décrivez ce que Nadia devrait changer EN PREMIER pour reprendre le contrôle de son temps — en restant professionnelle dans son contexte kényan.", allValid: false, feedback: "", minChars: 40, savedForProject: true },
              ],
            },
            {
              title: "Étape 2 — Plan d'action pour Nadia",
              durationEstimate: "10 min",
              intro: "",
              questions: [
                { id: "n2.1", kind: "mcq", prompt: "Pour arrêter de recevoir des messages de son directeur à 22h, quelle approche est la plus adaptée au contexte kényan ?", options: [
                  { key: "A", label: "Nadia ne répond plus aux messages après 20h — son directeur comprendra progressivement." },
                  { key: "B", label: "Nadia fixe un entretien pour expliquer que ces messages tardifs l'épuisent." },
                  { key: "C", label: "Nadia propose un point de fin de journée de 15 minutes à 17h30 pour anticiper les besoins du lendemain, ce qui réduira les messages tardifs en créant un espace d'anticipation." },
                  { key: "D", label: "Nadia demande à ses collègues de parler à son manager en son nom." },
                ], correctKey: "C", allValid: false, savedForProject: false,
                  feedback: "La solution C ne confronte pas le directeur sur son comportement (culturellement risqué), elle propose une alternative constructive qui sert ses intérêts. Un point quotidien de 15 minutes à 17h30 répond à son besoin de contrôle tout en réduisant les messages tardifs — un changement systémique présenté comme un service." },
                { id: "n2.2", kind: "mcq", prompt: "Pour réduire les interruptions de ses collègues sans les froisser dans son organisation, quelle stratégie est la plus adaptée ?", options: [
                  { key: "A", label: "Nadia installe des écouteurs et ne répond plus aux visites non planifiées." },
                  { key: "B", label: "Nadia annonce à toute son équipe qu'elle ne sera disponible que sur rendez-vous." },
                  { key: "C", label: "Nadia communique ses créneaux de disponibilité et propose une boîte de collecte de demandes écrites pour les autres moments." },
                  { key: "D", label: "Nadia change de bureau pour être moins accessible physiquement." },
                ], correctKey: "C", allValid: false, savedForProject: false,
                  feedback: "Communiquer ses créneaux de disponibilité : elle ne rejette pas ses collègues (la relation est préservée), crée une structure prévisible (les collègues savent quand venir), et protège ses plages de travail concentré. La boîte de demandes écrites éduque progressivement sur la nature réelle des urgences." },
                { id: "n2.3", kind: "mcq", prompt: "Comment Nadia protège-t-elle les 3 premières heures de sa journée — les plus productives mais les plus interrompues ?", options: [
                  { key: "A", label: "Elle arrive 1h30 plus tôt pour travailler dans le calme avant ses collègues." },
                  { key: "B", label: "Elle négocie avec son directeur un créneau de 2 heures le matin en mode travail concentré, le communique à son équipe, et désactive les notifications pendant ce créneau." },
                  { key: "C", label: "Elle fait le travail le plus important le soir, une fois rentrée chez elle, dans le calme." },
                  { key: "D", label: "Elle cherche une salle de réunion libre chaque matin pour travailler sans être dérangée." },
                ], correctKey: "B", allValid: false, savedForProject: false,
                  feedback: "La solution B est la plus systémique et durable : elle crée une norme organisationnelle (le créneau de concentration est connu et accepté) plutôt qu'une stratégie de contournement. La négociation ascendante avec le directeur donne une légitimité institutionnelle — essentielle dans les hiérarchies." },
              ],
            },
            {
              title: "Étape 3 — Transfert personnel",
              durationEstimate: "7 min",
              intro: "",
              questions: [
                { id: "n3.1", kind: "open", prompt: "En quoi la situation de Nadia ressemble-t-elle à celle que vous avez décrite dans votre Moment d'Ancrage au Bloc 0 — {{moment_ancrage}} ? Décrivez en deux phrases ce que vous partagez avec elle.", allValid: false, feedback: "", minChars: 60, savedForProject: true },
                { id: "n3.2", kind: "mcq", prompt: "Si vous deviez appliquer un seul réflexe de ce Bloc 1 dès cette semaine dans votre organisation, lequel choisiriez-vous ?", options: [
                  { key: "A", label: "Cartographier mes deux types de temps et identifier mon principal voleur de temps." },
                  { key: "B", label: "Appliquer la matrice africaine des priorités à ma liste de tâches de lundi." },
                  { key: "C", label: "Rédiger ma phrase de signalement bienveillant et la tester avec un collègue cette semaine." },
                  { key: "D", label: "Concevoir mon système de temps protégé et le négocier avec ma hiérarchie africaine." },
                ], allValid: true, savedForProject: false,
                  feedback: "Le choix idéal dépend de votre profil de gestion du temps — chaque option est valide. Ce qui compte est de choisir une action concrète et de la mettre en œuvre avant la prochaine micro-session." },
              ],
            },
          ],
          summary: [
            "Je comprends la tension entre le temps polychronique africain et le temps monochronique organisationnel — et je sais dans lequel j'opère principalement.",
            "Je maîtrise la matrice africaine des priorités et j'ai identifié mes principales sources d'urgences artificielles.",
            "J'ai conçu mon système de temps protégé et mes outils personnels de gestion des interruptions adaptés à mon contexte.",
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
      durationEstimate: "~1 h 35 · 3 micro-sessions + 2 activités longues",
      units: [
        { label: "MS 2.1 — Vidéo 7 + exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 2.2 — Vidéo 8 + exercice", type: "micro-session", durationMin: 10 },
        { label: "MS 2.3 — Vidéo 9 + exercice", type: "micro-session", durationMin: 10 },
        { label: "Mises en situation guidées + quiz interbloc (21 + 9 min)", type: "long-activity", durationMin: 30 },
        { label: "Application terrain (obligatoire)", type: "long-activity", durationMin: 35 },
      ],
      badge: {
        type: "PRACTICE",
        label: "Badge Pratique",
        conditions: ["3 vidéos + exercices (2.1–2.3)", "Mises en situation guidées complétées", "Quiz interbloc fait", "Application terrain soumise"],
      },
      payload: {
        microSessions: [ms21, ms22, ms23],
        guidedScenariosTitle: "Activité Expérientielle Longue — Mises en situation guidées",
        guidedScenariosDuration: "21 min",
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
          title: "Quiz interbloc — consolidation des Blocs 1 et 2 (non noté)",
          durationEstimate: "9 min",
          scored: false,
          questions: [
            { id: "ib1", scenarioText: "Votre manager rwandais envoie un message à 20h avec « pour info ». Le lendemain il demande si vous l'avez vu. Que signifie « pour info » ici ?", options: [
              { key: "A", label: "Souvent une demande implicite — une brève confirmation est socialement attendue." },
              { key: "B", label: "Il attend une confirmation de lecture dans la soirée." },
              { key: "C", label: "Aucune action attendue, c'était juste informatif." },
              { key: "D", label: "Attendre qu'il précise explicitement ce qu'il attend." },
            ], correctKey: "A", feedbackText: "« Pour info » signifie souvent « j'aimerais une réaction » sans le formuler ; lire les codes implicites est une compétence de navigation organisationnelle africaine.", subArea: "implicite" },
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
              { key: "C", label: "J'envoie un email à mon manager pour signaler la perturbation." },
              { key: "D", label: "Je passe 20 min à noter les 3 résultats non accomplis et à les planifier, puis je pars." },
            ], correctKey: "D", feedbackText: "Le rituel du vendredi : 20 minutes de planification maintenant valent 3 heures de confusion lundi matin.", subArea: "rituels" },
          ],
        },
        fieldApplication: {
          title: "Activité Expérientielle Longue — Application terrain",
          durationEstimate: "35 min",
          brief:
            "Mission — Reprendre le contrôle de mon temps dans mon organisation. L'application terrain est obligatoire pour accéder au Bloc 3. Elle se déroule dans votre environnement professionnel réel, en repartant de votre Moment d'Ancrage : {{moment_ancrage}}.",
          steps: [
            {
              title: "Étape 1 — Identifier mon principal problème de productivité (~10 min)",
              intro: "Pré-rempli avec votre Moment d'Ancrage du Bloc 0 — complétez et précisez : {{moment_ancrage}}",
              fields: [
                { label: "La situation de gestion du temps que je veux résoudre", placeholder: "…" },
                { label: "Les obstacles spécifiques à mon organisation", placeholder: "…" },
                { label: "L'impact concret de ce problème sur ma performance et mon bien-être", placeholder: "…" },
              ],
            },
            {
              title: "Étape 2 — Mettre en œuvre une solution concrète (~15 min)",
              intro: "Reprenez votre système de temps protégé du micro-exercice 1.5 : pour chaque outil, décrivez la mise en œuvre concrète et l'adaptation culturelle réalisée.",
              fields: [
                { label: "Mon système de temps protégé — mise en œuvre concrète", placeholder: "…" },
                { label: "Mon système de temps protégé — adaptation culturelle réalisée", placeholder: "…" },
                { label: "Ma phrase de signalement bienveillant — mise en œuvre concrète", placeholder: "…" },
                { label: "Ma phrase de signalement bienveillant — adaptation culturelle réalisée", placeholder: "…" },
                { label: "Mon « oui différent » avec ma hiérarchie — mise en œuvre concrète", placeholder: "…" },
                { label: "Mon « oui différent » avec ma hiérarchie — adaptation culturelle réalisée", placeholder: "…" },
              ],
            },
            {
              title: "Étape 3 — Documenter la réaction et l'impact (~10 min)",
              intro: "",
              fields: [
                { label: "Réaction de mon organisation à mes nouveaux comportements", placeholder: "…" },
                { label: "Obstacles culturels africains rencontrés", placeholder: "…" },
                { label: "Ce que j'ajuste pour la semaine suivante", placeholder: "…" },
              ],
            },
          ],
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
      durationEstimate: "~1 h 25 · 3 micro-sessions + 1 activité longue",
      units: [
        { label: "MS 3.1 — Vidéo 10 + micro-exercice", type: "micro-session", durationMin: 15 },
        { label: "Activité Expérientielle Longue — Productivité hybride", type: "long-activity", durationMin: 35, children: [
          { label: "Vidéo 11 — Productivité hybride dans les organisations africaines", type: "micro-task", durationMin: 5 },
          { label: "Cas transversal Sylvie", type: "micro-task", durationMin: 20 },
          { label: "Auto-évaluation (6 critères)", type: "micro-task", durationMin: 10 },
        ] },
        { label: "MS 3.2 — Plan d'action 30 jours", type: "micro-session", durationMin: 20 },
        { label: "MS 3.3 — Quiz final (noté · seuil 70 %)", type: "micro-session", durationMin: 15 },
      ],
      // Affichage apprenant : la vidéo 3.2, le cas Sylvie et l'auto-évaluation
      // se présentent comme UNE activité longue (5 + 20 + 10 min).
      itemGroups: [
        { title: "Activité Expérientielle Longue — Productivité hybride", durationLabel: "5 + 20 + 10 min", keys: ["3.2", "case", "self"] },
      ],
      badge: {
        type: "ANCHORING",
        label: "Badge Ancrage",
        conditions: ["Vidéos 10–11 + exercices", "Auto-évaluation 6 critères", "Cas Sylvie complété", "Plan d'action 30 j soumis", "Quiz final ≥ 70 %"],
      },
      payload: {
        microSessions: [ms31, ms32],
        // CAS TRANSVERSAL DE SYNTHÈSE (~20 min · LMS natif) — enchaîné juste
        // après la vidéo « Productivité hybride » (MS 3.2), énoncé complet.
        transversalCase: {
          title: "Cas transversal de synthèse",
          subtitle: "Sylvie à Abidjan",
          durationEstimate: "20 min",
          context:
            "Sylvie a 30 ans. Responsable administrative dans une agence de communication à Abidjan. Elle manage 4 personnes, dont 2 à distance. Ses journées sont envahies par les sollicitations internes et externes, elle n'arrive pas à finir ses propres dossiers, et son équipe manque de visibilité sur ses priorités. Elle a lu des livres sur la productivité mais aucune méthode n'a tenu plus de 3 semaines dans son environnement ivoirien.",
          steps: [],
          structuredSteps: [
            {
              title: "Cas Sylvie — diagnostic, méthode, équipe hybride",
              durationEstimate: "20 min",
              intro: "",
              questions: [
                { id: "s1", kind: "mcq", prompt: "Quel est le premier diagnostic à poser sur la situation de Sylvie avant de lui recommander un outil ?", options: [
                  { key: "A", label: "Elle manque d'outils de productivité — il faut lui recommander une application." },
                  { key: "B", label: "Son problème principal est la gestion de ses sollicitations — elle doit apprendre à dire non." },
                  { key: "C", label: "Avant tout outil, il faut identifier si son problème est d'ordre personnel (méthode), organisationnel (culture de son agence) ou systémique (charge réellement excessive). L'outil vient après le diagnostic." },
                  { key: "D", label: "Elle doit apprendre à déléguer davantage à son équipe." },
                ], correctKey: "C", allValid: false, savedForProject: false,
                  feedback: "Recommander un outil sans diagnostic traite le symptôme. Dans le contexte ivoirien de Sylvie, son problème semble mixte : personnel (méthode), organisationnel (culture de disponibilité) et peut-être systémique (charge réelle). Comprendre lequel est dominant conditionne l'efficacité de toute solution." },
                { id: "s2", kind: "mcq", prompt: "Sylvie a essayé 4 fois un rituel de planification et a toujours abandonné au bout de 2 semaines. Quelle est la cause la plus probable dans son contexte africain ?", options: [
                  { key: "A", label: "Elle manque de discipline personnelle." },
                  { key: "B", label: "La méthode qu'elle utilisait était trop complexe et rigide pour l'imprévision de son organisation ivoirienne." },
                  { key: "C", label: "La planification hebdomadaire ne fonctionne pas dans les organisations africaines." },
                  { key: "D", label: "Elle n'avait pas le soutien de son manager." },
                ], correctKey: "B", allValid: false, savedForProject: false,
                  feedback: "B est presque toujours la cause réelle : les méthodes de planification rigides échouent dans les environnements africains à haute imprévision parce qu'elles sont conçues pour des contextes stables. La solution n'est pas plus de discipline — c'est une méthode plus flexible basée sur 3 résultats prioritaires et un buffer africain." },
                { id: "s3", kind: "mcq", prompt: "Sylvie veut améliorer la productivité de son équipe hybride sans imposer de nouvelles contraintes. Quelle est sa première action ?", options: [
                  { key: "A", label: "Introduire un outil de gestion de projet (Trello, Asana) pour centraliser les tâches." },
                  { key: "B", label: "Organiser une réunion d'équipe pour établir des règles de communication communes — temps de réponse attendus, plages de disponibilité, canaux par type d'information." },
                  { key: "C", label: "Recruter un assistant pour gérer les sollicitations à sa place." },
                  { key: "D", label: "Demander à son manager de réduire sa charge de travail." },
                ], correctKey: "B", allValid: false, savedForProject: false,
                  feedback: "Avant tout outil, établir des règles de communication communes crée la structure relationnelle dans laquelle les outils peuvent fonctionner. Dans les équipes africaines, les règles implicites de communication sont la principale source de stress. Les rendre explicites et les négocier collectivement est la première intervention systémique." },
                { id: "s4", kind: "open", prompt: "Réflexion ouverte — Quel est le rituel de productivité que vous allez installer EN PREMIER dans les 7 prochains jours dans votre organisation africaine ? Décrivez précisément : le rituel, le moment, la durée et comment vous allez l'ancrer dans votre réalité africaine. (Réponse ancrée dans votre Moment d'Ancrage : {{moment_ancrage}}.)", allValid: false, feedback: "", minChars: 100, savedForProject: true },
              ],
            },
          ],
          summary: [],
        },
        selfAssessment: {
          title: "Auto-évaluation (6 critères)",
          durationEstimate: "10 min",
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
        // MICRO-SESSION 3.3 — Plan d'action 30 jours (~20 min · soumission LMS),
        // restructuré selon l'énoncé : 3 habitudes séquencées + signal de
        // progression + pair de progression.
        actionPlan30d: {
          title: "Micro-session 3.2 — Plan d'action 30 jours",
          durationEstimate: "20 min",
          intro: "Transformez vos apprentissages en engagements concrets. Repartez de vos exercices précédents (rituel du Cas Sylvie, temps protégé du micro-exercice 1.5) — complétez et ajustez selon votre réalité africaine actuelle.",
          habits: [
            { title: "Habitude 1 — Semaines 1 et 2 : le rituel de lancement de journée", fields: [
              "L'habitude concrète : chaque matin, avant d'ouvrir WhatsApp et mes emails, je passe … minutes à identifier ma seule priorité de la journée",
              "Le moment précis · la durée (min)",
              "Mon indicateur de réussite",
              "L'obstacle africain que j'anticipe",
              "Ma stratégie pour maintenir ce rituel malgré les imprévus",
            ] },
            { title: "Habitude 2 — Semaines 2 et 3 : le système de temps protégé", fields: [
              "L'habitude concrète : chaque semaine, je protège … plage(s) de … minutes de travail concentré, communiquées à ma hiérarchie et mes collègues",
              "Ma formulation de communication",
              "Mon signal de concentration adapté à mon bureau africain",
            ] },
            { title: "Habitude 3 — Semaines 3 et 4 : le rituel de planification hebdomadaire", fields: [
              "L'habitude concrète : chaque … (jour), à … h, je consacre … minutes à identifier mes 3 résultats prioritaires et planifier mon buffer africain",
              "Mon résultat prioritaire n° 1 de la semaine prochaine (à faire maintenant)",
              "Mon résultat prioritaire n° 2",
              "Mon résultat prioritaire n° 3",
            ] },
            { title: "Mon signal de progression en 30 jours", fields: [
              "D'ici 30 jours, le signe concret et observable qui me dira que ma gestion du temps s'est vraiment améliorée",
            ] },
            { title: "Mon pair de progression", fields: [
              "Ce que je vais partager avec lui cette semaine",
            ] },
          ],
        },
        finalQuiz: {
          title: "Micro-session 3.3 — Quiz final",
          durationEstimate: "15 min",
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
              { key: "B", label: "Je lui dis de revenir vendredi." },
              { key: "C", label: "Je continue sans le regarder." },
              { key: "D", label: "Je signale mon créneau et propose un moment précis dans l'heure." },
            ], correctKey: "D", feedbackText: "Signaler le créneau + proposer une alternative concrète : maintenir le focus et préserver la relation." },
            { id: "f4", scenarioText: "Semaine de 45 h, organisation nigériane. Combien d'heures max en tâches concrètes ?", options: [
              { key: "A", label: "45 h — tout le temps disponible." },
              { key: "B", label: "40 h — 5 h pour les urgences mineures." },
              { key: "C", label: "≈ 31 h — réserver 30 % de buffer africain." },
              { key: "D", label: "20 h — 3 grandes priorités uniquement." },
            ], correctKey: "C", feedbackText: "Le buffer africain de 30 % (≈ 13,5 h) absorbe les urgences sans détruire les priorités ; 40 h est insuffisant en haute imprévision." },
            { id: "f5", scenarioText: "Junior camerounais : premier draft insuffisant sur une tâche déléguée.", options: [
              { key: "A", label: "Je planifie 30 min pour revoir, identifier les lacunes et convenir d'une v2 sous 48h." },
              { key: "B", label: "Je reprends le travail moi-même." },
              { key: "C", label: "Je renvoie le draft avec des commentaires écrits et j'attends." },
              { key: "D", label: "J'escalade au manager pour me couvrir." },
            ], correctKey: "A", feedbackText: "Un draft insuffisant n'est pas un échec de la délégation : 30 min de coaching forment le junior et maintiennent la qualité." },
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
              { key: "B", label: "J'ai besoin d'un assistant pour filtrer." },
              { key: "C", label: "Les imprévus sont une fatalité." },
              { key: "D", label: "Mon buffer était insuffisant — l'augmenter à 35–40 % et analyser si ces urgences étaient anticipables." },
            ], correctKey: "D", feedbackText: "3 urgences non absorbées signalent un buffer trop faible ; beaucoup d'« imprévus » africains sont en réalité récurrents et anticipables." },
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
        { label: "Micro-session 4.1 — Section 1 — Description de la situation (~10 lignes)", type: "micro-session", durationMin: 15 },
        { label: "Micro-session 4.2 — Section 2 — La solution mise en œuvre", type: "micro-session", durationMin: 15 },
        { label: "Micro-session 4.3 — Section 3 — Résultat observé", type: "micro-session", durationMin: 15 },
        // The 6 journal micro-entries are SUB-UNITS of the 2-week journal long
        // activity (6 × 5 min = its 30 min) — not independent top-level units.
        { label: "Activité Expérientielle Longue — Section 4 — Journal des 2 semaines (6 micro-entrées)", type: "long-activity", durationMin: 30, children: [
          { label: "Journal J+2", type: "micro-task", durationMin: 5 },
          { label: "Journal J+4", type: "micro-task", durationMin: 5 },
          { label: "Journal J+6", type: "micro-task", durationMin: 5 },
          { label: "Journal J+9", type: "micro-task", durationMin: 5 },
          { label: "Journal J+11", type: "micro-task", durationMin: 5 },
          { label: "Journal J+15", type: "micro-task", durationMin: 5 },
        ] },
        { label: "Micro-session 4.4 — Section 5 — Apprentissage personnel", type: "micro-session", durationMin: 15 },
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
          { title: "Micro-session 4.1 — Section 1 — Description de la situation (~10 lignes)", durationEstimate: "15 min", helpText: "Pré-rempli depuis votre Moment d'Ancrage et l'Application terrain du Bloc 2 : contexte africain précis (pays, secteur, organisation), votre rôle, le problème, ses causes et son impact.", prefillFromMomentAncrage: true },
          { title: "Micro-session 4.2 — Section 2 — La solution mise en œuvre", durationEstimate: "15 min", helpText: "Outil principal, espace de mise en œuvre (formel/informel), adaptation culturelle africaine réalisée.", prefillFromMomentAncrage: false },
          { title: "Micro-session 4.3 — Section 3 — Résultat observé", durationEstimate: "15 min", helpText: "Impact sur votre productivité (concret, chiffré si possible) ; ce que vous avez appris sur les codes africains de gestion du temps.", prefillFromMomentAncrage: false },
          { title: "Activité Expérientielle Longue — Section 4 — Journal des 2 semaines (6 micro-entrées)", durationEstimate: "30 min", helpText: "Les 6 micro-entrées poussées automatiquement (J+2 → J+15), 5 minutes chacune. Chaque micro-entrée non complétée dans les 24h déclenche un rappel bienveillant ancré dans votre Moment d'Ancrage.", prefillFromMomentAncrage: false },
          { title: "Micro-session 4.4 — Section 5 — Apprentissage personnel", durationEstimate: "15 min", helpText: "Ce que vous avez compris sur votre relation au temps ; l'obstacle culturel surmonté ou contourné ; les 3 prochaines occasions de reprendre le contrôle ; ce que vous diriez à un pair qui commence ce parcours demain.", prefillFromMomentAncrage: false },
        ],
        journal: {
          // Every journal prompt re-injects the Moment d'Ancrage (Pilier 5.1).
          // Cadence J+2 → J+15 avec la question spécifique de chaque micro-entrée
          // (énoncé « Journal des 2 semaines », réponses 50 à 100 mots).
          entries: [
            { day: 2, prompt: "Vous aviez décrit {{moment_ancrage}}. Vous avez commencé à mettre en œuvre votre solution : décrivez en 2-3 lignes la première réaction concrète de votre environnement — verbale, comportementale ou intérieure.", minWords: 50 },
            { day: 4, prompt: "Vous aviez décrit {{moment_ancrage}}. Quel obstacle réel avez-vous rencontré ? Comment l'avez-vous géré, ou comment allez-vous le gérer dans les prochains jours ?", minWords: 50 },
            { day: 6, prompt: "Au regard de {{moment_ancrage}}, avez-vous observé un changement dans votre propre façon de répondre aux sollicitations depuis que vous avez commencé ? Donnez un exemple concret.", minWords: 50 },
            { day: 9, prompt: "Vous aviez commencé ce parcours pour traiter {{moment_ancrage}}. Qu'avez-vous partagé avec votre pair de progression ? Quelle a été sa perspective sur votre démarche dans votre contexte ?", minWords: 50 },
            { day: 11, prompt: "En repartant de {{moment_ancrage}}, quelle est la micro-victoire de productivité la plus significative de ces 10 premiers jours ? Soyez précis et concret.", minWords: 50 },
            { day: 15, prompt: "Par rapport à {{moment_ancrage}}, ce que ce parcours a transformé dans votre relation au temps dans votre organisation, et les 3 prochaines occasions de reprendre du contrôle que vous avez identifiées.", minWords: 50 },
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
