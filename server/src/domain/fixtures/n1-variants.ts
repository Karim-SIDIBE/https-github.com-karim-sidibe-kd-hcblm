/**
 * n1-variants.ts — AI-generated variant questions for the N1 course
 * (« Gestion du temps et productivité »), 4 variants per original question,
 * each with an imposed sector angle (labelled) so reviewers can spot
 * redundancy at a glance. Seeded into the bank as PENDING via
 * `scripts/seed-bank-variants.ts` — a human approves or rejects each one;
 * only approved questions become drawable by quiz pools.
 *
 * Typed against ScoredQuestion: schema conformity is checked at compile time.
 */
import type { ScoredQuestion } from "../content-model.js";

export type BankVariant = {
  /** Id of the original course question this varies (e.g. "diagnostic:d1"). */
  variantOf: string;
  /** Imposed angle, shown to the reviewer (anti-redundancy label). */
  angle: string;
  subArea: string;
  question: ScoredQuestion;
};

export const n1Variants: BankVariant[] = [
  // ───────────────────────── d1 — urgences imposées ─────────────────────────
  {
    variantOf: "diagnostic:d1", angle: "banque/finance", subArea: "urgences imposées",
    question: { id: "d1v1", subArea: "urgences imposées", scenarioText: "Agence bancaire à Dakar, 16h50. Votre directeur vous transfère un dossier client « à traiter avant l'ouverture demain », alors que vous bouclez le reporting réglementaire dû jeudi.", options: [
      { key: "A", label: "J'abandonne le reporting et traite le dossier client immédiatement." },
      { key: "B", label: "J'accuse réception, évalue le temps nécessaire et lui propose un arbitrage entre les deux échéances." },
      { key: "C", label: "Je transfère discrètement le dossier à un collègue du guichet." },
      { key: "D", label: "Je finis le reporting d'abord et regarderai le dossier demain à 7h30." },
    ], correctKey: "B", feedbackText: "Une « urgence » transférée n'est pas toujours une vraie urgence : accuser réception, chiffrer et rendre l'arbitrage au demandeur est le réflexe professionnel qui protège les deux échéances." },
  },
  {
    variantOf: "diagnostic:d1", angle: "ONG/projet", subArea: "urgences imposées",
    question: { id: "d1v2", subArea: "urgences imposées", scenarioText: "ONG à Ouagadougou. Le bailleur écrit à 17h : il veut « d'urgence » un tableau de suivi pour demain 9h. Vous étiez sur le rapport narratif attendu vendredi par le siège.", options: [
      { key: "A", label: "Je reste ce soir pour produire le tableau complet, le rapport attendra." },
      { key: "B", label: "Je confirme la demande, vérifie ce que « d'urgence » recouvre exactement et propose un périmètre réaliste pour 9h." },
      { key: "C", label: "Je réponds que le rapport narratif passe d'abord — le bailleur comprendra." },
      { key: "D", label: "J'envoie au bailleur le dernier tableau disponible sans vérifier." },
    ], correctKey: "B", feedbackText: "Clarifier le besoin réel derrière « urgent » (souvent : quelques indicateurs, pas le tableau complet) permet de répondre à 9h sans sacrifier l'engagement pris envers le siège." },
  },
  {
    variantOf: "diagnostic:d1", angle: "industrie/atelier", subArea: "urgences imposées",
    question: { id: "d1v3", subArea: "urgences imposées", scenarioText: "Atelier de production à Casablanca, 15h. Le chef d'usine exige un inventaire « urgent » des pièces détachées pour ce soir, alors que vous préparez la maintenance planifiée de la ligne 2 pour demain matin.", options: [
      { key: "A", label: "Je lance l'inventaire tout de suite — le chef d'usine prime." },
      { key: "B", label: "Je confirme, estime la durée des deux tâches et lui présente le choix : inventaire ce soir ou maintenance prête demain." },
      { key: "C", label: "Je fais les deux en restant jusqu'à minuit." },
      { key: "D", label: "Je demande à l'apprenti de faire l'inventaire sans supervision." },
    ], correctKey: "B", feedbackText: "Rendre visible le conflit de priorités au décideur (avec des durées chiffrées) transforme une injonction impossible en décision éclairée — et vous protège si la maintenance dérape." },
  },
  {
    variantOf: "diagnostic:d1", angle: "télétravail/numérique", subArea: "urgences imposées",
    question: { id: "d1v4", subArea: "urgences imposées", scenarioText: "En télétravail pour une entreprise de services à Tunis. À 17h10, message Teams de votre manager : « présentation client à refaire pour demain 8h30 », alors que vous êtes en pleine correction du livrable promis pour jeudi.", options: [
      { key: "A", label: "Je bascule immédiatement sur la présentation, tant pis pour le livrable." },
      { key: "B", label: "Je réponds en confirmant, demande ce qui doit changer précisément et propose un ordre de priorité entre les deux." },
      { key: "C", label: "Je ne réponds pas avant demain matin pour finir mon livrable au calme." },
      { key: "D", label: "Je retouche la présentation en 15 minutes sans demander de précisions." },
    ], correctKey: "B", feedbackText: "À distance encore plus qu'au bureau, l'accusé de réception + la question « que faut-il changer exactement ? » évitent des heures de travail dans la mauvaise direction et rendent l'arbitrage au manager." },
  },

  // ───────────────────────── d2 — interruptions ─────────────────────────
  {
    variantOf: "diagnostic:d2", angle: "administration publique", subArea: "interruptions",
    question: { id: "d2v1", subArea: "interruptions", scenarioText: "Ministère à Yaoundé. Vous avez bloqué 9h–11h pour rédiger une note stratégique. À 9h20, un collègue d'un autre service entre pour discuter d'un dossier sans échéance.", options: [
      { key: "A", label: "Je l'écoute longuement — dans l'administration, les relations priment." },
      { key: "B", label: "Je lui réponds sèchement que je suis occupé." },
      { key: "C", label: "Je l'accueille 5 minutes, note son sujet et lui propose 11h15 précises." },
      { key: "D", label: "Je fais semblant d'être au téléphone." },
    ], correctKey: "C", feedbackText: "Cinq minutes d'accueil + un rendez-vous précis : la relation est honorée, le créneau de rédaction est préservé, et le collègue voit que son sujet est pris au sérieux." },
  },
  {
    variantOf: "diagnostic:d2", angle: "commerce/distribution", subArea: "interruptions",
    question: { id: "d2v2", subArea: "interruptions", scenarioText: "Responsable de magasin à Abidjan, en plein comptage de caisse mensuel (opération qui exige une concentration totale). Un fournisseur passe « juste pour dire bonjour » et parler d'une future promotion.", options: [
      { key: "A", label: "J'arrête le comptage — un fournisseur, ça s'entretient." },
      { key: "B", label: "Je le salue chaleureusement, lui explique le comptage en cours et lui fixe 14h autour d'un café." },
      { key: "C", label: "Je compte en l'écoutant d'une oreille." },
      { key: "D", label: "Je lui demande de repasser un autre jour, sans précision." },
    ], correctKey: "B", feedbackText: "Un comptage interrompu se recommence. L'accueil chaleureux + le rendez-vous concret (14h, café) protège l'opération ET la relation commerciale — mieux qu'un « repassez un jour » vague." },
  },
  {
    variantOf: "diagnostic:d2", angle: "santé/clinique", subArea: "interruptions",
    question: { id: "d2v3", subArea: "interruptions", scenarioText: "Gestionnaire dans une clinique à Kigali. Vous préparez la paie du personnel (deadline aujourd'hui 17h). Une infirmière passe pour discuter du planning des congés de décembre.", options: [
      { key: "A", label: "Je traite sa demande — le personnel soignant d'abord." },
      { key: "B", label: "Je lui dis de voir ça avec quelqu'un d'autre." },
      { key: "C", label: "Je prends 3 minutes pour noter sa contrainte principale et lui donne rendez-vous demain 10h." },
      { key: "D", label: "Je l'écoute tout en continuant la paie sur l'écran." },
    ], correctKey: "C", feedbackText: "Une erreur de paie coûte bien plus cher qu'un planning de congés décalé de 24h. Noter la contrainte + fixer demain 10h montre du respect sans mettre la paie en danger." },
  },
  {
    variantOf: "diagnostic:d2", angle: "startup tech", subArea: "interruptions",
    question: { id: "d2v4", subArea: "interruptions", scenarioText: "Développeuse dans une startup à Lagos, casque sur les oreilles, plage de « deep work » affichée sur Slack jusqu'à 12h. Un commercial tapote votre épaule pour une question sur une fonctionnalité, « ça prend 2 minutes ».", options: [
      { key: "A", label: "Je retire le casque et traite sa question — l'esprit startup, c'est l'entraide." },
      { key: "B", label: "Je pointe mon statut Slack sans un mot et me retourne vers l'écran." },
      { key: "C", label: "Je note sa question en 1 minute, lui promets une réponse à 12h05, et je replonge." },
      { key: "D", label: "Je réponds « vite fait » — mais la discussion dure 25 minutes." },
    ], correctKey: "C", feedbackText: "Les « 2 minutes » coûtent en réalité 20 à 30 minutes de re-concentration. Capturer la question + donner une heure de réponse ferme protège le flow sans humilier le collègue." },
  },

  // ───────────────────────── d3 — priorisation ─────────────────────────
  {
    variantOf: "diagnostic:d3", angle: "BTP/chantier", subArea: "priorisation",
    question: { id: "d3v1", subArea: "priorisation", scenarioText: "Conducteur de travaux à Bamako, 7h30 sur le chantier. Votre journée liste 9 points : validations techniques, appels fournisseurs, et le dossier de réception provisoire — décisif pour le paiement — à préparer.", options: [
      { key: "A", label: "Les petits appels fournisseurs d'abord, pour « déblayer »." },
      { key: "B", label: "Le tour du chantier pour voir ce qui brûle." },
      { key: "C", label: "Le dossier de réception provisoire, dès maintenant, avant que le chantier ne m'absorbe." },
      { key: "D", label: "Je répartis les 9 points en créneaux d'une demi-heure." },
    ], correctKey: "C", feedbackText: "Le dossier qui conditionne le paiement est l'important par excellence. S'il ne passe pas en premier, le chantier dévorera la journée — comme tous les jours." },
  },
  {
    variantOf: "diagnostic:d3", angle: "éducation/formation", subArea: "priorisation",
    question: { id: "d3v2", subArea: "priorisation", scenarioText: "Directrice d'un centre de formation à Cotonou, 8h. Au programme : 14 tâches, dont la réponse à l'appel d'offres qui ferme dans 3 jours (2 h de travail exigeant) et une pile de messages de parents.", options: [
      { key: "A", label: "Les messages des parents — la réputation du centre en dépend." },
      { key: "B", label: "Les tâches rapides pour alléger la liste." },
      { key: "C", label: "L'appel d'offres, deux heures porte fermée, avant tout le reste." },
      { key: "D", label: "Un peu de tout, par rotation de 20 minutes." },
    ], correctKey: "C", feedbackText: "L'appel d'offres est important ET exigeant : il réclame vos meilleures heures. Les messages de parents seront tout aussi bien traités à 10h30 — l'inverse n'est pas vrai." },
  },
  {
    variantOf: "diagnostic:d3", angle: "logistique/transport", subArea: "priorisation",
    question: { id: "d3v3", subArea: "priorisation", scenarioText: "Responsable logistique à Mombasa, 8h15. Douze tâches en attente : suivis de conteneurs, litiges mineurs, et la renégociation annuelle du contrat transporteur (fort enjeu financier) que vous repoussez depuis lundi.", options: [
      { key: "A", label: "Les suivis de conteneurs — c'est le cœur du quotidien." },
      { key: "B", label: "La renégociation du contrat, maintenant, pendant que l'énergie est là." },
      { key: "C", label: "Les litiges mineurs pour vider la liste." },
      { key: "D", label: "Je réponds d'abord aux emails de la nuit." },
    ], correctKey: "B", feedbackText: "Ce qu'on repousse depuis lundi est presque toujours l'important non urgent. Les premières heures de la journée sont le seul créneau où ce type de tâche a une chance réelle." },
  },
  {
    variantOf: "diagnostic:d3", angle: "hôtellerie", subArea: "priorisation",
    question: { id: "d3v4", subArea: "priorisation", scenarioText: "Gérante d'un hôtel à Saint-Louis, 8h. Liste du jour : 10 points opérationnels + le plan de trésorerie des 3 prochains mois demandé par la banque pour un prêt de rénovation.", options: [
      { key: "A", label: "Le tour des étages et de la réception d'abord — l'opérationnel avant tout." },
      { key: "B", label: "Le plan de trésorerie en premier, 90 minutes au calme avant l'arrivée des clients." },
      { key: "C", label: "Les réponses aux avis clients en ligne." },
      { key: "D", label: "Je délègue le plan de trésorerie au comptable externe." },
    ], correctKey: "B", feedbackText: "Le prêt conditionne l'avenir de l'hôtel ; le tour des étages peut se faire à 10h. L'important structurel se traite le matin, quand la tête est claire et l'hôtel encore calme." },
  },

  // ───────────────────────── d4 — réunions ─────────────────────────
  {
    variantOf: "diagnostic:d4", angle: "banque/finance", subArea: "réunions",
    question: { id: "d4v1", subArea: "réunions", scenarioText: "Banque à Libreville : la direction convoque une réunion de 2h30 cet après-midi, sans ordre du jour, alors que vous devez livrer l'analyse crédit d'un gros dossier avant demain 10h.", options: [
      { key: "A", label: "J'y assiste en entier — on ne se fait pas remarquer en refusant." },
      { key: "B", label: "Je demande l'ordre du jour et propose de n'assister qu'à la partie qui me concerne." },
      { key: "C", label: "J'y vais avec mon ordinateur et j'avance l'analyse pendant la réunion." },
      { key: "D", label: "J'y assiste entièrement et je préviens dès maintenant le client interne que l'analyse arrivera à 12h au lieu de 10h." },
    ], correctKey: "D", feedbackText: "Assister (respect de la hiérarchie) tout en renégociant l'autre engagement EN AMONT : l'impact est géré activement au lieu d'être subi — c'est ça, le professionnalisme." },
  },
  {
    variantOf: "diagnostic:d4", angle: "ONG/projet", subArea: "réunions",
    question: { id: "d4v2", subArea: "réunions", scenarioText: "ONG à Niamey. Le coordinateur pays convoque « tout le staff » pour 3h de réunion demain matin — précisément quand vous deviez finaliser le rapport bailleur dont l'échéance est demain 17h (il reste 4h de travail).", options: [
      { key: "A", label: "Je sèche la réunion — le rapport bailleur est vital." },
      { key: "B", label: "J'assiste et je verrai bien si je finis le rapport à temps." },
      { key: "C", label: "J'assiste, et je préviens dès ce soir le coordinateur que le rapport occupera tout mon après-midi, en sanctuarisant 13h–17h." },
      { key: "D", label: "Je demande à un collègue de prendre des notes pour moi." },
    ], correctKey: "C", feedbackText: "Ni absence risquée, ni passivité : présence à la réunion + sanctuarisation négociée à l'avance de l'après-midi. Le conflit d'agenda est annoncé avant, pas découvert après." },
  },
  {
    variantOf: "diagnostic:d4", angle: "industrie/atelier", subArea: "réunions",
    question: { id: "d4v3", subArea: "réunions", scenarioText: "Usine agroalimentaire à Nairobi : réunion qualité surprise de 2h convoquée à 14h, alors que vous devez superviser à 15h le redémarrage de la chaîne après nettoyage — étape critique.", options: [
      { key: "A", label: "Je vais à la réunion et laisse la chaîne redémarrer sans moi." },
      { key: "B", label: "Je signale immédiatement le conflit, propose d'être présent la première heure et de sortir à 15h pour le redémarrage." },
      { key: "C", label: "Je reste à la chaîne et m'excuse après coup." },
      { key: "D", label: "J'envoie un opérateur me représenter à la réunion." },
    ], correctKey: "B", feedbackText: "Annoncer le conflit tout de suite + proposer une présence partielle bornée : la hiérarchie est respectée, l'étape critique est couverte, et c'est vous qui structurez le compromis." },
  },
  {
    variantOf: "diagnostic:d4", angle: "télétravail/numérique", subArea: "réunions",
    question: { id: "d4v4", subArea: "réunions", scenarioText: "Équipe distribuée entre Dakar et Paris. On vous ajoute à une visio de 2h « alignement général » qui chevauche le créneau où vous deviez produire le livrable client du jour.", options: [
      { key: "A", label: "J'accepte la visio en caméra coupée et je produis le livrable en parallèle." },
      { key: "B", label: "Je décline sans explication — mon livrable d'abord." },
      { key: "C", label: "Je demande l'agenda, signale mon conflit, et propose d'assister aux 30 minutes qui me concernent puis de lire le compte rendu." },
      { key: "D", label: "J'assiste aux 2h et je livrerai le client demain." },
    ], correctKey: "C", feedbackText: "Le multitâche en visio produit deux résultats médiocres. Demander l'agenda + présence ciblée + compte rendu : vous honorez l'équipe ET le client, sans tricher." },
  },

  // ───────────────────────── d5 — présentéisme ─────────────────────────
  {
    variantOf: "diagnostic:d5", angle: "administration publique", subArea: "présentéisme",
    question: { id: "d5v1", subArea: "présentéisme", scenarioText: "Direction des impôts à Lomé, vendredi 17h20. Votre note d'analyse est aux deux tiers ; il faudrait 50 minutes pour la finir. Le bureau ferme à 18h et vous êtes épuisé.", options: [
      { key: "A", label: "Je reste jusqu'à 18h10 — un fonctionnaire consciencieux finit ce qu'il commence." },
      { key: "B", label: "Je consigne l'état exact (⅔ faits, plan des 2 sections restantes) et je reprends lundi 8h à tête reposée." },
      { key: "C", label: "Je bâcle la fin en 25 minutes pour pouvoir dire que c'est fini." },
      { key: "D", label: "J'emporte le dossier chez moi pour le week-end." },
    ], correctKey: "B", feedbackText: "50 minutes de rédaction épuisée le vendredi produisent un texte à réécrire lundi. Documenter l'état exact transforme la reprise de lundi en 40 minutes efficaces." },
  },
  {
    variantOf: "diagnostic:d5", angle: "startup tech", subArea: "présentéisme",
    question: { id: "d5v2", subArea: "présentéisme", scenarioText: "Startup à Accra, vendredi 18h45. Votre correctif de code est presque terminé mais un test échoue encore. Vous êtes le dernier au bureau et la fatigue se fait sentir.", options: [
      { key: "A", label: "Je m'acharne jusqu'à ce que le test passe, même à 22h." },
      { key: "B", label: "Je pousse le code tel quel — on verra lundi si ça casse." },
      { key: "C", label: "Je note précisément l'état (test en échec, pistes explorées, prochaine hypothèse) et je reprends lundi frais." },
      { key: "D", label: "Je supprime le test qui échoue." },
    ], correctKey: "C", feedbackText: "Le débogage fatigué du vendredi soir crée souvent le bug du lundi. Une note précise (état, pistes, hypothèse suivante) vaut trois heures d'acharnement nocturne." },
  },
  {
    variantOf: "diagnostic:d5", angle: "commerce/distribution", subArea: "présentéisme",
    question: { id: "d5v3", subArea: "présentéisme", scenarioText: "Samedi 19h40, supermarché à Douala. L'inventaire du rayon frais est aux trois quarts. La fermeture est à 20h, vous enchaînez depuis 7h du matin.", options: [
      { key: "A", label: "Je finis l'inventaire coûte que coûte, même après la fermeture." },
      { key: "B", label: "Je note précisément où j'en suis (rayons comptés, écarts relevés) et je finis lundi à l'ouverture, au calme." },
      { key: "C", label: "J'estime le quart restant de tête pour boucler le chiffre ce soir." },
      { key: "D", label: "Je demande au vigile de finir le comptage." },
    ], correctKey: "B", feedbackText: "Un inventaire compté par un cerveau à 12h de service, c'est des écarts à re-vérifier. Le point d'arrêt documenté est la vraie rigueur — pas l'acharnement." },
  },
  {
    variantOf: "diagnostic:d5", angle: "santé/clinique", subArea: "présentéisme",
    question: { id: "d5v4", subArea: "présentéisme", scenarioText: "Vendredi 17h45, hôpital à Antananarivo. Le rapport d'activité mensuel du service est à 70 % ; votre garde s'achève à 18h après une semaine chargée. Le rapport est attendu mardi.", options: [
      { key: "A", label: "Je reste 2h de plus — partir serait mal vu." },
      { key: "B", label: "Je consigne l'avancement (70 %, données restantes listées) et je bloque lundi 9h–10h30 pour finir." },
      { key: "C", label: "Je le finis dimanche à la maison." },
      { key: "D", label: "Je remets les chiffres approximatifs, quitte à corriger après." },
    ], correctKey: "B", feedbackText: "L'échéance est mardi : rien n'exige un sacrifice vendredi soir. Documenter + bloquer le créneau de lundi, c'est la maîtrise du temps — le présentéisme n'est pas une preuve de sérieux." },
  },

  // ───────────────────────── d6 — communication ─────────────────────────
  {
    variantOf: "diagnostic:d6", angle: "banque/finance", subArea: "communication",
    question: { id: "d6v1", subArea: "communication", scenarioText: "Depuis 3 semaines, vous fermez votre bureau de 9h à 11h pour traiter les dossiers de crédit (agence de Brazzaville). Un collègue lance devant l'équipe : « Monsieur est devenu inaccessible. »", options: [
      { key: "A", label: "Je rouvre ma porte — l'image d'équipe avant tout." },
      { key: "B", label: "Je réponds que mes résultats parlent pour moi." },
      { key: "C", label: "J'explique le créneau, montre comment me joindre en cas d'urgence réelle, et rappelle que je suis pleinement disponible dès 11h." },
      { key: "D", label: "Je passe mes créneaux fermés en télétravail pour éviter les remarques." },
    ], correctKey: "C", feedbackText: "La remarque publique teste votre système. L'explication calme + le canal d'urgence + la disponibilité affichée dès 11h transforment la critique en pédagogie — sans céder ni braquer." },
  },
  {
    variantOf: "diagnostic:d6", angle: "éducation/formation", subArea: "communication",
    question: { id: "d6v2", subArea: "communication", scenarioText: "Proviseure adjointe à Conakry. Vous réservez 7h30–9h aux dossiers administratifs, porte fermée. Un enseignant se plaint en salle des professeurs : « On ne peut plus jamais te voir le matin. »", options: [
      { key: "A", label: "J'abandonne le créneau — un établissement vit de sa disponibilité." },
      { key: "B", label: "Je maintiens sans rien expliquer." },
      { key: "C", label: "J'explique le créneau en réunion, précise que 9h–17h reste grand ouvert, et donne la procédure pour les urgences élèves." },
      { key: "D", label: "Je déplace le créneau chaque jour pour être moins prévisible." },
    ], correctKey: "C", feedbackText: "Un système de temps protégé ne survit que s'il est expliqué et assorti d'un canal d'urgence crédible. La transparence transforme la frustration en respect du cadre." },
  },
  {
    variantOf: "diagnostic:d6", angle: "logistique/transport", subArea: "communication",
    question: { id: "d6v3", subArea: "communication", scenarioText: "Chef d'exploitation dans une société de transport à Dar es Salaam. Vos deux heures quotidiennes de planification des tournées (5h30–7h30) sont sacrées. Un chauffeur senior grommelle : « Avant, on pouvait te parler le matin. »", options: [
      { key: "A", label: "Je réponds que c'est comme ça maintenant." },
      { key: "B", label: "J'explique que ces 2h garantissent leurs tournées sans cafouillage, et je crée un point chauffeurs quotidien à 7h35." },
      { key: "C", label: "Je reprends les discussions matinales — les chauffeurs sont le cœur du métier." },
      { key: "D", label: "Je planifie les tournées la veille au soir, après 20h." },
    ], correctKey: "B", feedbackText: "Relier le créneau protégé à un bénéfice CONCRET pour eux (« vos tournées sans cafouillage ») + offrir un rendez-vous fixe juste après : le système devient un service rendu, pas un mur." },
  },
  {
    variantOf: "diagnostic:d6", angle: "télétravail/numérique", subArea: "communication",
    question: { id: "d6v4", subArea: "communication", scenarioText: "Consultante en télétravail à Rabat. Votre statut Slack affiche « Focus 9h–12h » depuis un mois. La cheffe de projet écrit : « Tu ne réponds jamais le matin, c'est compliqué de travailler avec toi. »", options: [
      { key: "A", label: "Je supprime le créneau focus — le reproche vient d'en haut." },
      { key: "B", label: "Je réponds que mes livrables sont toujours à l'heure, point." },
      { key: "C", label: "J'appelle pour réexpliquer le créneau, convenir d'un canal d'urgence (appel direct) et d'un point quotidien à 12h15." },
      { key: "D", label: "Je réponds désormais aux messages en cachette pendant le focus." },
    ], correctKey: "C", feedbackText: "À distance, un statut écrit ne suffit pas : il faut la conversation de vive voix qui installe le contrat (focus + canal d'urgence + point fixe). C'est elle qui transforme le reproche en accord." },
  },

  // ───────────────────────── d7 — WhatsApp ─────────────────────────
  {
    variantOf: "diagnostic:d7", angle: "commerce/distribution", subArea: "WhatsApp",
    question: { id: "d7v1", subArea: "WhatsApp", scenarioText: "Grossiste à Kumasi : une centaine de messages WhatsApp par jour (clients, livreurs, fournisseurs), de 5h30 à 22h. Vous n'arrivez plus à préparer les commandes sans interruption.", options: [
      { key: "A", label: "Je coupe le téléphone toute la journée et rappelle le soir." },
      { key: "B", label: "Je réponds au fil de l'eau — dans le commerce, chaque message est un client." },
      { key: "C", label: "Trois créneaux de réponse annoncés (8h, 13h, 18h) + un numéro réservé aux livraisons du jour, toujours ouvert." },
      { key: "D", label: "Je confie mon WhatsApp à un apprenti sans consignes." },
    ], correctKey: "C", feedbackText: "Le client tolère très bien une réponse à heure fixe s'il la connaît — pas le silence total. Le second canal « livraisons du jour » couvre la seule vraie urgence du métier." },
  },
  {
    variantOf: "diagnostic:d7", angle: "ONG/projet", subArea: "WhatsApp",
    question: { id: "d7v2", subArea: "WhatsApp", scenarioText: "Chargée de projet à N'Djamena, 7 groupes WhatsApp actifs (équipes terrain, partenaires, bailleur), ~90 messages/jour jusqu'à tard le soir. Votre rédaction de rapports en souffre.", options: [
      { key: "A", label: "Je quitte les groupes non essentiels sans prévenir." },
      { key: "B", label: "Trois consultations par jour annoncées aux équipes + notifications actives uniquement sur le groupe « incidents terrain »." },
      { key: "C", label: "Je réponds à tout dans l'heure, la nuit s'il le faut — le terrain n'attend pas." },
      { key: "D", label: "Je lis tout mais ne réponds qu'aux messages du bailleur." },
    ], correctKey: "B", feedbackText: "Hiérarchiser les canaux (incidents terrain = temps réel, le reste = 3 fenêtres annoncées) protège la rédaction sans jamais couper le lien avec le terrain — l'équilibre exact recherché." },
  },
  {
    variantOf: "diagnostic:d7", angle: "BTP/chantier", subArea: "WhatsApp",
    question: { id: "d7v3", subArea: "WhatsApp", scenarioText: "Ingénieure travaux sur 3 chantiers à Abidjan : chefs d'équipe, fournisseurs et clients vous écrivent sur WhatsApp de 6h à 21h (~70 messages/jour). Vos métrés et plannings prennent du retard.", options: [
      { key: "A", label: "Je traite les messages en continu depuis le pick-up entre deux chantiers." },
      { key: "B", label: "Créneaux de réponse 7h/12h30/17h communiqués + appel vocal direct réservé aux blocages de chantier." },
      { key: "C", label: "Je ne réponds plus qu'aux clients." },
      { key: "D", label: "Je coupe les notifications définitivement sans le dire." },
    ], correctKey: "B", feedbackText: "Sur un chantier, la vraie urgence se dit de vive voix. Formaliser « blocage = appel, le reste = 3 créneaux » évite que le planning se fasse dévorer par le fil de messages." },
  },
  {
    variantOf: "diagnostic:d7", angle: "administration publique", subArea: "WhatsApp",
    question: { id: "d7v4", subArea: "WhatsApp", scenarioText: "Cadre dans une mairie à Porto-Novo. Le groupe WhatsApp interne mélange consignes officielles, débats et messages personnels : ~60/jour, y compris le week-end. Vous ratez parfois les vraies consignes.", options: [
      { key: "A", label: "Je lis tout, tout de suite, pour ne rien rater." },
      { key: "B", label: "Je quitte le groupe et exige des notes de service papier." },
      { key: "C", label: "Deux lectures ciblées par jour + demande au secrétariat de marquer les consignes officielles d'un préfixe convenu (ex. [OFFICIEL])." },
      { key: "D", label: "Je réponds uniquement aux messages du maire." },
    ], correctKey: "C", feedbackText: "Le problème n'est pas le volume mais l'absence de tri. Deux fenêtres de lecture + une convention de marquage rendent les consignes fiables sans vous enchaîner au téléphone." },
  },

  // ───────────────────────── d8 — délégation ─────────────────────────
  {
    variantOf: "diagnostic:d8", angle: "banque/finance", subArea: "délégation",
    question: { id: "d8v1", subArea: "délégation", scenarioText: "Chef d'agence à Abidjan : vous devez confier la préparation des dossiers de crédit simples à une jeune analyste, mais vous avez toujours tout contrôlé vous-même.", options: [
      { key: "A", label: "Je lui remets une procédure de 15 pages et vérifie chaque dossier ligne à ligne." },
      { key: "B", label: "Je garde les dossiers — une erreur de crédit coûte trop cher." },
      { key: "C", label: "Je définis le résultat attendu et les critères de qualité, lui donne deux dossiers modèles, et fixe une revue après les 3 premiers." },
      { key: "D", label: "Je la laisse se débrouiller — c'est comme ça qu'on apprend." },
    ], correctKey: "C", feedbackText: "Résultat attendu + exemples + jalon de revue : c'est la délégation du résultat, pas de la méthode. Le contrôle ligne à ligne (A) vous coûte plus de temps que de tout faire vous-même." },
  },
  {
    variantOf: "diagnostic:d8", angle: "hôtellerie", subArea: "délégation",
    question: { id: "d8v2", subArea: "délégation", scenarioText: "Gérant d'un lodge à Arusha : vous voulez confier la gestion des réservations en ligne à votre réceptionniste prometteuse, mais vous répondez vous-même à chaque demande depuis 5 ans.", options: [
      { key: "A", label: "Je lui montre une fois, puis je reprends dès la première erreur." },
      { key: "B", label: "Je définis le résultat (réponse < 4h, ton, règles tarifaires), lui laisse la main et fais un point quotidien la première semaine." },
      { key: "C", label: "Je continue à tout faire — les réservations, c'est trop sensible." },
      { key: "D", label: "Je lui transfère le compte sans consignes ni suivi." },
    ], correctKey: "B", feedbackText: "Cadre clair + autonomie sur la méthode + points rapprochés au début puis espacés : la seule voie qui libère réellement votre temps tout en faisant grandir la réceptionniste." },
  },
  {
    variantOf: "diagnostic:d8", angle: "industrie/atelier", subArea: "délégation",
    question: { id: "d8v3", subArea: "délégation", scenarioText: "Chef d'atelier de menuiserie à Kampala. Une commande de 20 tables doit partir vendredi ; vous voulez confier le contrôle qualité final à votre second, que vous n'avez jamais lâché seul.", options: [
      { key: "A", label: "Je contrôle derrière lui chaque table — question de réputation." },
      { key: "B", label: "Je lui remets la grille de contrôle, on vérifie 3 tables ensemble, puis il continue seul et m'appelle au moindre doute." },
      { key: "C", label: "Je fais le contrôle moi-même de nuit, comme d'habitude." },
      { key: "D", label: "Je lui dis simplement « vérifie bien » et je passe à autre chose." },
    ], correctKey: "B", feedbackText: "La passation en 3 pièces témoins + une grille + un canal de doute ouvert : transfert de compétence réel, sans double contrôle qui ruine le gain de temps ni lâchage sans filet." },
  },
  {
    variantOf: "diagnostic:d8", angle: "startup tech", subArea: "délégation",
    question: { id: "d8v4", subArea: "délégation", scenarioText: "CTO d'une fintech à Nairobi. Vous codez encore vous-même les rapports hebdomadaires d'activité alors qu'un développeur junior motivé pourrait les reprendre.", options: [
      { key: "A", label: "Je garde les rapports — c'est moi que la direction lit." },
      { key: "B", label: "Je lui spécifie le résultat (contenu, format, échéance du jeudi 17h), lui montre le dernier rapport, et relis les deux premiers avant envoi." },
      { key: "C", label: "Je lui transfère le script sans explication." },
      { key: "D", label: "Je lui dicte chaque semaine, ligne par ligne, ce qu'il doit écrire." },
    ], correctKey: "B", feedbackText: "Spécifier le résultat + un modèle + une relecture bornée aux deux premiers : le junior monte en compétence, et votre temps de CTO retourne à l'architecture — sa vraie valeur." },
  },

  // ───────────────────────── d9 — négociation ─────────────────────────
  {
    variantOf: "diagnostic:d9", angle: "ONG/projet", subArea: "négociation",
    question: { id: "d9v1", subArea: "négociation", scenarioText: "ONG à Bangui : le projet a 4 semaines de retard sur le calendrier bailleur. La cheffe de mission vous demande de « mettre les bouchées doubles, soirées et samedis compris, jusqu'à rattraper ». Vous êtes déjà saturé.", options: [
      { key: "A", label: "J'accepte — on ne discute pas avec une cheffe de mission." },
      { key: "B", label: "Je refuse en invoquant mon contrat." },
      { key: "C", label: "Je demande 24h, analyse la cause réelle du retard (validation bailleur lente) et reviens avec 3 scénarios chiffrés." },
      { key: "D", label: "Je propose de sacrifier un samedi sur deux." },
    ], correctKey: "C", feedbackText: "Le retard vient rarement d'un manque d'heures. Analyser la cause et revenir avec des scénarios déplace la discussion du sacrifice personnel vers le vrai problème — et c'est vous qui structurez la solution." },
  },
  {
    variantOf: "diagnostic:d9", angle: "commerce/distribution", subArea: "négociation",
    question: { id: "d9v2", subArea: "négociation", scenarioText: "Directrice adjointe d'une chaîne de boutiques à Marrakech. Le directeur exige que vous gériez personnellement l'ouverture du nouveau point de vente EN PLUS de vos 5 boutiques, « juste pour 2 mois ».", options: [
      { key: "A", label: "J'accepte tout — c'est une marque de confiance." },
      { key: "B", label: "Je demande un délai de réflexion, cartographie ma charge réelle et propose 3 options (transfert partiel, renfort, périmètre réduit)." },
      { key: "C", label: "Je refuse : mes 5 boutiques suffisent." },
      { key: "D", label: "J'accepte à condition d'une prime." },
    ], correctKey: "B", feedbackText: "La cartographie de charge rend le conflit visible et factuel ; les 3 options laissent le directeur décider en connaissance de cause. Vous démontrez la maîtrise, pas la mauvaise volonté." },
  },
  {
    variantOf: "diagnostic:d9", angle: "administration publique", subArea: "négociation",
    question: { id: "d9v3", subArea: "négociation", scenarioText: "Préfecture à Thiès : le secrétaire général vous confie l'organisation d'un forum régional dans 3 semaines, en sus de vos attributions, « parce que vous êtes le plus fiable ». Votre service est déjà en flux tendu.", options: [
      { key: "A", label: "J'accepte sans conditions — un tel signe de confiance ne se refuse pas." },
      { key: "B", label: "Je décline poliment en invoquant la charge du service." },
      { key: "C", label: "Je remercie, demande 48h, et reviens avec un plan précisant ce qu'il faut suspendre ou renforcer pour réussir le forum." },
      { key: "D", label: "J'accepte et je répartis discrètement le travail sur mes agents déjà saturés." },
    ], correctKey: "C", feedbackText: "Accepter la mission ET poser ses conditions de réussite dans le même mouvement : le « oui différent » appliqué à la hiérarchie administrative. La confiance est honorée sans sacrifier le service." },
  },
  {
    variantOf: "diagnostic:d9", angle: "santé/clinique", subArea: "négociation",
    question: { id: "d9v4", subArea: "négociation", scenarioText: "Clinique à Bujumbura : le directeur médical vous demande de couvrir les gardes administratives d'un collègue absent « pendant quelques semaines », en plus des vôtres. Vous frôlez déjà les 55h hebdomadaires.", options: [
      { key: "A", label: "J'accepte — l'esprit d'équipe dans la santé n'est pas négociable." },
      { key: "B", label: "Je demande un point rapide, expose mes 55h factuelles, et propose une rotation à trois avec limite de durée écrite." },
      { key: "C", label: "Je refuse net : mes heures sont déjà dépassées." },
      { key: "D", label: "J'accepte une semaine et j'aviserai." },
    ], correctKey: "B", feedbackText: "Les faits (55h) + une contre-proposition organisée (rotation, durée bornée) : la solidarité est réelle mais structurée — sans quoi « quelques semaines » devient un régime permanent." },
  },

  // ───────────────────────── d10 — auto-positionnement ─────────────────────────
  {
    variantOf: "diagnostic:d10", angle: "bilan mensuel", subArea: "auto-positionnement",
    question: { id: "d10v1", profiling: true, subArea: "auto-positionnement", scenarioText: "En repensant à votre dernier mois de travail, quelle phrase décrit le mieux votre rapport aux échéances ?", options: [
      { key: "A", label: "J'ai livré l'essentiel à temps, en gardant la main sur mon agenda." },
      { key: "B", label: "J'ai passé le mois à éteindre les feux des autres ; mes propres échéances ont glissé." },
      { key: "C", label: "J'ai repoussé plusieurs fois les mêmes tâches, avec un poids grandissant." },
      { key: "D", label: "J'ai un système qui tient à peu près, mais je le contourne souvent." },
    ], correctKey: "B", feedbackText: "Chaque réponse révèle un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). Aucune n'est « mauvaise » — elle indique votre point de départ." },
  },
  {
    variantOf: "diagnostic:d10", angle: "rapport au téléphone", subArea: "auto-positionnement",
    question: { id: "d10v2", profiling: true, subArea: "auto-positionnement", scenarioText: "Quelle phrase décrit le mieux votre relation à votre téléphone au travail ?", options: [
      { key: "A", label: "Je le consulte à des moments choisis ; il me sert plus qu'il ne me commande." },
      { key: "B", label: "Chaque notification m'arrache à ce que je fais ; je termine mes journées vidé sans avoir avancé mes dossiers." },
      { key: "C", label: "Je m'y réfugie quand une tâche me pèse, puis je culpabilise du temps perdu." },
      { key: "D", label: "J'ai des règles d'usage, mais elles sautent dès que la journée se tend." },
    ], correctKey: "B", feedbackText: "Chaque réponse révèle un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). L'identifier honnêtement est le point de départ du parcours." },
  },
  {
    variantOf: "diagnostic:d10", angle: "fin de journée", subArea: "auto-positionnement",
    question: { id: "d10v3", profiling: true, subArea: "auto-positionnement", scenarioText: "À 18h, en fermant votre journée de travail, quelle pensée vous est la plus familière ?", options: [
      { key: "A", label: "« L'important d'aujourd'hui est fait ; demain est déjà cadré. »" },
      { key: "B", label: "« Je n'ai pas arrêté une seconde… et rien de MA liste n'a avancé. »" },
      { key: "C", label: "« Encore une journée où j'ai évité LE dossier qui compte. »" },
      { key: "D", label: "« Ma méthode a tenu jusqu'à 14h, puis tout s'est délité. »" },
    ], correctKey: "B", feedbackText: "Chaque réponse révèle un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). Le parcours part de là où vous êtes réellement." },
  },
  {
    variantOf: "diagnostic:d10", angle: "regard des collègues", subArea: "auto-positionnement",
    question: { id: "d10v4", profiling: true, subArea: "auto-positionnement", scenarioText: "Si vos collègues décrivaient honnêtement votre façon de travailler, que diraient-ils probablement ?", options: [
      { key: "A", label: "« Fiable et organisé — on sait quand et comment le solliciter. »" },
      { key: "B", label: "« Toujours disponible pour tout le monde… souvent au détriment de ses propres dossiers. »" },
      { key: "C", label: "« Plein de bonne volonté, mais ses gros dossiers traînent toujours. »" },
      { key: "D", label: "« Il a de bonnes méthodes, quand il s'y tient. »" },
    ], correctKey: "B", feedbackText: "Chaque réponse révèle un profil (A productif maîtrisé · B débordé réactif · C procrastinateur/submergé · D organisateur en développement). Le regard extérieur imaginé aide souvent à se positionner plus honnêtement." },
  },

  // ───────────────────────── ib1 — implicite ─────────────────────────
  {
    variantOf: "interblock:ib1", angle: "banque/finance", subArea: "implicite",
    question: { id: "ib1v1", subArea: "implicite", scenarioText: "Votre directrice d'agence à Cotonou vous met en copie d'un échange tendu avec un client important, sans commentaire. Le lendemain, elle semble déçue que vous n'ayez « rien fait ». Que signifiait cette mise en copie ?", options: [
      { key: "A", label: "Une simple information d'archivage." },
      { key: "B", label: "Elle voulait que je réponde au client à sa place." },
      { key: "C", label: "Souvent une demande implicite : au minimum, signaler qu'on a vu et proposer son aide." },
      { key: "D", label: "Rien — c'est à elle d'être explicite." },
    ], correctKey: "C", feedbackText: "La mise en copie sans commentaire est un classique du langage implicite hiérarchique : elle attend au minimum un signe (« vu, je peux aider sur X »). Lire ces codes évite les déceptions silencieuses." },
  },
  {
    variantOf: "interblock:ib1", angle: "administration publique", subArea: "implicite",
    question: { id: "ib1v2", subArea: "implicite", scenarioText: "Réunion de service à Lomé. En sortant, le directeur lance : « Ce dossier D24, il faudrait vraiment que quelqu'un s'y penche un jour… » en vous regardant brièvement. Que venez-vous d'entendre ?", options: [
      { key: "A", label: "Une réflexion générale sans destinataire." },
      { key: "B", label: "Très probablement une attribution implicite : clarifier rapidement (« souhaitez-vous que je m'en charge ? ») est le bon réflexe." },
      { key: "C", label: "Une critique de mon collègue en charge du dossier." },
      { key: "D", label: "Un simple constat qui n'appelle aucune réaction." },
    ], correctKey: "B", feedbackText: "Le « quelqu'un devrait » + regard appuyé est une attribution voilée fréquente. Faire préciser tout de suite transforme l'implicite en mission claire — ou vous en libère explicitement." },
  },
  {
    variantOf: "interblock:ib1", angle: "startup tech", subArea: "implicite",
    question: { id: "ib1v3", subArea: "implicite", scenarioText: "Le CEO de votre startup à Kigali partage dans le canal Slack général un article sur « les dashboards clients qui font vendre », suivi d'un simple « 👀 ». Vous êtes le responsable produit. Comment le lire ?", options: [
      { key: "A", label: "Une veille partagée, rien de plus." },
      { key: "B", label: "Un reproche public sur le dashboard actuel." },
      { key: "C", label: "Un signal d'intérêt fort : accuser réception et proposer d'en discuter est prudent (« sujet noté — j'esquisse une proposition ? »)." },
      { key: "D", label: "Attendre qu'il crée un ticket officiel." },
    ], correctKey: "C", feedbackText: "Dans les cultures orales ET dans les startups, l'allusion précède souvent la demande formelle. Réagir tôt à faible coût (« j'esquisse ? ») vous positionne sans vous engager à l'aveugle." },
  },
  {
    variantOf: "interblock:ib1", angle: "hôtellerie", subArea: "implicite",
    question: { id: "ib1v4", subArea: "implicite", scenarioText: "La propriétaire de l'hôtel où vous êtes chef de réception (Zanzibar) vous dit en passant : « Ma nièce arrive vendredi, elle adore la chambre 12… » — qui est réservée par un autre client. Que venez-vous d'entendre ?", options: [
      { key: "A", label: "Une anecdote familiale sans conséquence." },
      { key: "B", label: "Une demande implicite de réorganiser les réservations : mieux vaut clarifier maintenant les attentes et les limites (« je regarde ce qui est possible sans léser le client »)." },
      { key: "C", label: "Un ordre direct de déloger le client de la 12." },
      { key: "D", label: "Un test de ma loyauté." },
    ], correctKey: "B", feedbackText: "L'allusion familiale est une demande qui ne veut pas se dire. Clarifier avec tact (possibilités + limites) évite le double piège : ignorer le souhait de la propriétaire ou léser un client payant." },
  },

  // ───────────────────────── ib2 — priorisation ─────────────────────────
  {
    variantOf: "interblock:ib2", angle: "ONG/projet", subArea: "priorisation",
    question: { id: "ib2v1", subArea: "priorisation", scenarioText: "Lundi matin au bureau de l'ONG à Maroua, 6 tâches devant vous. Selon la méthode du parcours, laquelle ouvre la journée ?", options: [
      { key: "A", label: "Les emails et groupes WhatsApp du week-end." },
      { key: "B", label: "La cartographie des risques du projet — difficile, sans échéance imminente, mais déterminante pour la mission." },
      { key: "C", label: "La tâche que le coordinateur a qualifiée d'« urgente » vendredi soir." },
      { key: "D", label: "Le classement des factures — rapide et satisfaisant." },
    ], correctKey: "B", feedbackText: "Le critère n'est ni l'urgence déclarée ni la facilité : c'est l'importance pour la mission. Les premières heures de lucidité appartiennent au travail de fond." },
  },
  {
    variantOf: "interblock:ib2", angle: "commerce/distribution", subArea: "priorisation",
    question: { id: "ib2v2", subArea: "priorisation", scenarioText: "Gérante de boutique à Bobo-Dioulasso, lundi 7h45, cinq tâches : réassort, vitrines, négociation du nouveau bail (échéance dans 1 mois, fort enjeu), messages clients, ménage. Par quoi commencer selon la méthode ?", options: [
      { key: "A", label: "Les messages clients — la réactivité fait vendre." },
      { key: "B", label: "Le dossier du bail : une heure de préparation sérieuse avant l'ouverture." },
      { key: "C", label: "Le réassort — c'est l'opérationnel vital." },
      { key: "D", label: "La vitrine, visible par tous." },
    ], correctKey: "B", feedbackText: "Le bail engage des années de loyer ; le réassort et les vitrines se font très bien à 10h. L'important structurel se traite en premier, jamais « quand il restera du temps » — il n'en reste jamais." },
  },
  {
    variantOf: "interblock:ib2", angle: "santé/clinique", subArea: "priorisation",
    question: { id: "ib2v3", subArea: "priorisation", scenarioText: "Administrateur d'un centre de santé à Ségou, lundi matin, 5 chantiers : commande de médicaments (rupture possible dans 3 semaines), plannings, factures assurance, réponse à l'appel à projets santé maternelle (clôture dans 10 jours), rangement des archives.", options: [
      { key: "A", label: "Les plannings — l'équipe attend." },
      { key: "B", label: "L'appel à projets, 90 minutes au calme dès maintenant." },
      { key: "C", label: "Les factures — c'est la trésorerie." },
      { key: "D", label: "Un peu de chaque, pour que tout avance." },
    ], correctKey: "B", feedbackText: "L'appel à projets est important, exigeant et à échéance ferme : le candidat idéal pour les premières heures. Le « un peu de tout » (D) est l'illusion d'avancer qui ne produit rien de fini." },
  },
  {
    variantOf: "interblock:ib2", angle: "télétravail/numérique", subArea: "priorisation",
    question: { id: "ib2v4", subArea: "priorisation", scenarioText: "Freelance en télétravail à Dakar, lundi 8h30 : relances de prospects, comptabilité, formation en ligne à finir, et la proposition commerciale pour le plus gros contrat de l'année (rendez-vous jeudi). Par quoi commencer ?", options: [
      { key: "A", label: "Les relances — sans prospects, pas de futur." },
      { key: "B", label: "La proposition commerciale du gros contrat, écran plein, notifications coupées." },
      { key: "C", label: "La comptabilité qui traîne depuis des semaines." },
      { key: "D", label: "30 minutes de formation pour « se chauffer »." },
    ], correctKey: "B", feedbackText: "Le contrat de l'année se joue jeudi : c'est LA tâche importante de la semaine. Elle prend les meilleures heures de lundi — les relances et la compta vivront très bien cet après-midi." },
  },

  // ───────────────────────── ib3 — interruptions ─────────────────────────
  {
    variantOf: "interblock:ib3", angle: "banque/finance", subArea: "interruptions",
    question: { id: "ib3v1", subArea: "interruptions", scenarioText: "Analyste dans une banque à Tunis, créneau de concentration 14h–16h annoncé à l'équipe. À 14h40, le directeur adjoint (hiérarchiquement au-dessus) vous demande « un coup de main rapide » sur un tableur.", options: [
      { key: "A", label: "J'y vais immédiatement — on ne fait pas attendre un directeur adjoint." },
      { key: "B", label: "Je réponds que je suis en créneau focus, sans plus." },
      { key: "C", label: "Je lui rappelle poliment mon créneau et lui propose 16h05 fermes — sauf si c'est bloquant pour lui maintenant." },
      { key: "D", label: "Je quitte mon créneau et rattraperai ce soir." },
    ], correctKey: "C", feedbackText: "Même face à la hiérarchie, le créneau se défend — avec une porte de sortie explicite (« sauf si bloquant »). Neuf fois sur dix, 16h05 convient parfaitement ; la dixième, vous avez montré votre loyauté." },
  },
  {
    variantOf: "interblock:ib3", angle: "éducation/formation", subArea: "interruptions",
    question: { id: "ib3v2", subArea: "interruptions", scenarioText: "Formatrice à Ouagadougou, en train de corriger des évaluations pendant votre créneau annoncé (15h–17h). Le doyen des formateurs frappe : il veut discuter « 5 minutes » de la répartition des salles.", options: [
      { key: "A", label: "Je le reçois — c'est le doyen." },
      { key: "B", label: "Je lui signale mon créneau de correction et lui propose 17h autour d'un thé." },
      { key: "C", label: "Je corrige en l'écoutant à moitié." },
      { key: "D", label: "Je lui demande de m'écrire un mot." },
    ], correctKey: "B", feedbackText: "Le respect dû au doyen s'exprime dans la QUALITÉ de l'alternative (17h, thé, attention pleine) — pas dans l'abandon du créneau. Les corrections interrompues sont les erreurs de demain." },
  },
  {
    variantOf: "interblock:ib3", angle: "logistique/transport", subArea: "interruptions",
    question: { id: "ib3v3", subArea: "interruptions", scenarioText: "Responsable d'entrepôt à Tema, en plein pointage hebdomadaire des stocks (créneau affiché sur la porte). Le doyen des caristes, très respecté, entre pour parler d'un souci de matériel non urgent.", options: [
      { key: "A", label: "J'arrête le pointage — son ancienneté l'exige." },
      { key: "B", label: "Je lui dis de repasser sans préciser quand." },
      { key: "C", label: "Je l'accueille, note son souci en 2 minutes et lui donne rendez-vous à la fin du pointage, à 15h30 précises." },
      { key: "D", label: "Je pointe en l'écoutant, quitte à recompter deux allées." },
    ], correctKey: "C", feedbackText: "L'ancienneté mérite l'accueil et un rendez-vous ferme — pas le sacrifice du pointage (recompter coûte une heure). La précision de l'heure EST la marque de respect." },
  },
  {
    variantOf: "interblock:ib3", angle: "startup tech", subArea: "interruptions",
    question: { id: "ib3v4", subArea: "interruptions", scenarioText: "Cheffe de projet dans une startup à Abidjan, créneau focus partagé dans l'agenda d'équipe. Un cofondateur passe : « t'as 2 minutes pour parler du pitch investisseurs ? » (le pitch est dans 3 semaines).", options: [
      { key: "A", label: "J'accepte — un cofondateur, ça passe avant tout." },
      { key: "B", label: "Je propose 15h30 aujourd'hui même, en précisant que je suis en focus jusqu'à 15h." },
      { key: "C", label: "Je réponds « 2 minutes alors » — et on y passe 40." },
      { key: "D", label: "Je l'ignore, il verra mon statut." },
    ], correctKey: "B", feedbackText: "Un pitch à 3 semaines n'a rien d'urgent. L'alternative le jour même (15h30) honore l'importance du sujet ET le créneau — c'est le réflexe qui installe durablement le respect du focus." },
  },

  // ───────────────────────── ib4 — planification ─────────────────────────
  {
    variantOf: "interblock:ib4", angle: "BTP/chantier", subArea: "planification",
    question: { id: "ib4v1", subArea: "planification", scenarioText: "Vous planifiez la semaine d'un chantier à Conakry : pluies fréquentes, livraisons de ciment aléatoires, coupures d'eau. Quelle règle de planification appliquez-vous ?", options: [
      { key: "A", label: "Planifier chaque heure des équipes pour maximiser le rendement." },
      { key: "B", label: "Garder 30 à 40 % de marge (tâches de repli en intérieur, stocks tampons) pour absorber les aléas réels." },
      { key: "C", label: "Ne rien planifier — sur un chantier africain, tout change chaque jour." },
      { key: "D", label: "Planifier seulement les matinées." },
    ], correctKey: "B", feedbackText: "Le buffer n'est pas du temps perdu : c'est la condition pour que le planning survive au réel (pluie, ciment en retard). 100 % planifié = 100 % sûr d'échouer." },
  },
  {
    variantOf: "interblock:ib4", angle: "santé/clinique", subArea: "planification",
    question: { id: "ib4v2", subArea: "planification", scenarioText: "Vous organisez la semaine du service administratif d'un hôpital à Lubumbashi : urgences imprévisibles, coupures d'électricité, visites officielles inopinées. Règle d'or ?", options: [
      { key: "A", label: "Remplir l'agenda à 100 % — un hôpital ne peut pas se permettre de temps mort." },
      { key: "B", label: "Réserver 30 à 40 % de capacité non allouée pour absorber urgences et imprévus." },
      { key: "C", label: "Planifier au jour le jour, chaque matin." },
      { key: "D", label: "Déléguer la planification à chaque agent individuellement." },
    ], correctKey: "B", feedbackText: "Là où l'imprévu est structurel, la marge est structurelle aussi. Les 30–40 % non alloués sont précisément ce qui permet aux 60–70 % planifiés de se réaliser vraiment." },
  },
  {
    variantOf: "interblock:ib4", angle: "commerce/distribution", subArea: "planification",
    question: { id: "ib4v3", subArea: "planification", scenarioText: "Vous préparez la semaine de votre commerce à Lomé pendant la saison des fêtes : affluence imprévisible, livraisons incertaines, personnel parfois absent. Comment structurez-vous le planning ?", options: [
      { key: "A", label: "Un planning serré à l'heure près pour toute l'équipe." },
      { key: "B", label: "Un tiers du temps laissé en réserve : renforts mobilisables, tâches déplaçables, plage tampon quotidienne." },
      { key: "C", label: "Pas de planning en période de fêtes — de l'adaptation pure." },
      { key: "D", label: "Le même planning qu'en période normale, en « serrant les dents »." },
    ], correctKey: "B", feedbackText: "Plus la période est imprévisible, plus la réserve doit être grande. Le tiers en réserve n'est pas de l'improvisation : c'est de l'imprévu ORGANISÉ." },
  },
  {
    variantOf: "interblock:ib4", angle: "télétravail/numérique", subArea: "planification",
    question: { id: "ib4v4", subArea: "planification", scenarioText: "Freelance à Antananarivo : connexion instable, coupures d'électricité programmées par quartier, clients dans 3 fuseaux horaires. Comment planifiez-vous votre semaine ?", options: [
      { key: "A", label: "Huit heures de production facturables par jour, du lundi au vendredi." },
      { key: "B", label: "60 à 70 % de charge facturable, le reste en marge : tâches hors-ligne prêtes, créneaux de rattrapage, batterie chargée." },
      { key: "C", label: "Travailler la nuit quand la connexion est meilleure." },
      { key: "D", label: "Accepter moins de clients pour ne jamais être débordé." },
    ], correctKey: "B", feedbackText: "La marge se prépare : liste de tâches hors-ligne, créneaux de rattrapage identifiés. C'est elle qui transforme une coupure de 3h en simple bascule d'activité au lieu d'une crise." },
  },

  // ───────────────────────── ib5 — délégation ─────────────────────────
  {
    variantOf: "interblock:ib5", angle: "banque/finance", subArea: "délégation",
    question: { id: "ib5v1", subArea: "délégation", scenarioText: "Vous avez confié la préparation d'un dossier client à un jeune chargé de clientèle (agence de Niamey). Deux jours sans nouvelles malgré votre email de suivi. Le rendez-vous client est dans 3 jours.", options: [
      { key: "A", label: "Je reprends le dossier — on ne joue pas avec un client." },
      { key: "B", label: "J'envoie un email plus sec, copie au chef d'agence." },
      { key: "C", label: "Je passe le voir directement pour comprendre où il bloque et débloquer avec lui." },
      { key: "D", label: "J'attends encore un jour : il faut responsabiliser." },
    ], correctKey: "C", feedbackText: "Deux jours de silence après délégation signalent presque toujours un blocage non avoué, pas de la paresse. Le contact direct débloque en 10 minutes ce que trois emails aggravent." },
  },
  {
    variantOf: "interblock:ib5", angle: "ONG/projet", subArea: "délégation",
    question: { id: "ib5v2", subArea: "délégation", scenarioText: "Vous avez délégué la collecte des données terrain à un animateur communautaire au Nord-Kivu. Son rapport hebdomadaire n'est pas arrivé et il ne répond pas aux messages depuis 48h.", options: [
      { key: "A", label: "Je le signale au coordinateur comme défaillant." },
      { key: "B", label: "Je l'appelle directement (ou passe par le chef de village) pour comprendre : réseau ? sécurité ? difficulté avec l'outil ?" },
      { key: "C", label: "Je renvoie le même message chaque matin." },
      { key: "D", label: "Je confie la zone à un autre animateur." },
    ], correctKey: "B", feedbackText: "Sur le terrain, un silence a mille causes légitimes (réseau, sécurité, outil). Chercher le contact direct AVANT de sanctionner ou remplacer : c'est à la fois plus juste et plus efficace." },
  },
  {
    variantOf: "interblock:ib5", angle: "industrie/atelier", subArea: "délégation",
    question: { id: "ib5v3", subArea: "délégation", scenarioText: "Vous avez confié au magasinier la mise à jour du fichier des stocks (usine à Tanger). Trois jours après, aucune mise à jour visible et pas de réponse à votre message sur le groupe de l'équipe.", options: [
      { key: "A", label: "Je fais la mise à jour moi-même dimanche." },
      { key: "B", label: "Je descends au magasin discuter avec lui : y voir un problème d'outil, de compréhension ou de charge." },
      { key: "C", label: "Je le recadre par écrit avec copie aux RH." },
      { key: "D", label: "Je mets un deuxième magasinier sur la tâche, en parallèle." },
    ], correctKey: "B", feedbackText: "Le silence d'un délégataire est un symptôme à diagnostiquer sur place, pas une faute à sanctionner d'emblée. Souvent : un fichier illisible ou une consigne mal comprise — dix minutes de discussion suffisent." },
  },
  {
    variantOf: "interblock:ib5", angle: "éducation/formation", subArea: "délégation",
    question: { id: "ib5v4", subArea: "délégation", scenarioText: "Vous avez demandé à un jeune surveillant (lycée à Porto-Novo) de préparer le planning des examens blancs. À 4 jours de l'échéance : rien, et il vous évite dans les couloirs.", options: [
      { key: "A", label: "Je récupère le planning et le fais ce soir." },
      { key: "B", label: "Je le convoque officiellement dans mon bureau." },
      { key: "C", label: "Je vais vers lui de façon informelle (pause, cour) pour ouvrir la discussion et identifier le blocage." },
      { key: "D", label: "Je demande à un enseignant de « le surveiller »." },
    ], correctKey: "C", feedbackText: "L'évitement signale la peur de décevoir, pas le désintérêt. L'approche informelle abaisse l'enjeu et libère la parole ; la convocation officielle la fige. Débloquer d'abord, cadrer ensuite." },
  },

  // ───────────────────────── ib6 — rituels ─────────────────────────
  {
    variantOf: "interblock:ib6", angle: "commerce/distribution", subArea: "rituels",
    question: { id: "ib6v1", subArea: "rituels", scenarioText: "Samedi 19h30, fin d'une semaine chaotique dans votre boutique à Douala : deux livraisons ratées, une panne de climatisation, un pic client imprévu. Que faites-vous avant de fermer ?", options: [
      { key: "A", label: "Je reste 2h pour rattraper la paperasse en retard." },
      { key: "B", label: "Je ferme et je décompresse — je verrai lundi." },
      { key: "C", label: "Vingt minutes : je note les 3 dossiers non traités et je leur réserve un créneau la semaine prochaine, puis je ferme." },
      { key: "D", label: "J'écris un long message à mon fournisseur pour me plaindre." },
    ], correctKey: "C", feedbackText: "Le rituel de clôture n'est pas du rattrapage : 20 minutes pour transformer le chaos en plan de reprise. Lundi commence alors par l'action, pas par la reconstitution mentale de la semaine passée." },
  },
  {
    variantOf: "interblock:ib6", angle: "administration publique", subArea: "rituels",
    question: { id: "ib6v2", subArea: "rituels", scenarioText: "Vendredi 16h45 dans votre service à Kinshasa. La semaine a été engloutie par trois commissions imprévues et une visite ministérielle. Vos dossiers de fond n'ont pas avancé. Avant de partir ?", options: [
      { key: "A", label: "Je reste tard pour avancer au moins un dossier." },
      { key: "B", label: "Je pars — la semaine est perdue de toute façon." },
      { key: "C", label: "Je prends 20 minutes : liste des 3 résultats non atteints, créneaux bloqués la semaine suivante, puis je pars l'esprit clair." },
      { key: "D", label: "J'écris au directeur pour signaler que les commissions empêchent le travail de fond." },
    ], correctKey: "C", feedbackText: "20 minutes de clôture valent 3 heures de confusion le lundi. La semaine n'est « perdue » que si elle ne produit même pas le plan de la suivante." },
  },
  {
    variantOf: "interblock:ib6", angle: "startup tech", subArea: "rituels",
    question: { id: "ib6v3", subArea: "rituels", scenarioText: "Vendredi 18h dans votre startup à Accra : le sprint a déraillé (bug critique en production mardi, demo client avancée jeudi). Le backlog prévu est intact. Que faites-vous avant le week-end ?", options: [
      { key: "A", label: "Je code jusqu'à 22h pour « sauver le sprint »." },
      { key: "B", label: "Vingt minutes : je note les 3 tâches reportées, les re-priorise pour lundi et j'écris 3 lignes de bilan dans le canal d'équipe." },
      { key: "C", label: "Je ferme tout — la rétro est prévue de toute façon dans deux semaines." },
      { key: "D", label: "Je reprogramme tout le backlog dimanche soir." },
    ], correctKey: "B", feedbackText: "Le mini-bilan du vendredi (20 min, écrit, partagé) est le rituel qui empêche un sprint dérapé de contaminer le suivant. L'héroïsme du vendredi soir, lui, produit surtout des bugs." },
  },
  {
    variantOf: "interblock:ib6", angle: "BTP/chantier", subArea: "rituels",
    question: { id: "ib6v4", subArea: "rituels", scenarioText: "Vendredi 17h sur votre chantier à Nouakchott : la semaine a été mangée par une panne de grue et deux visites client imprévues. Trois tâches planifiées n'ont pas démarré. Avant de libérer les équipes ?", options: [
      { key: "A", label: "Je garde une équipe deux heures de plus pour entamer le retard." },
      { key: "B", label: "Je pars comme tout le monde — lundi est un autre jour." },
      { key: "C", label: "Vingt minutes avec mon chef d'équipe : les 3 tâches non faites sont replanifiées avec leurs prérequis (matériaux, engins) pour lundi 7h." },
      { key: "D", label: "J'appelle le client pour renégocier tout le planning du mois." },
    ], correctKey: "C", feedbackText: "Sur un chantier, replanifier sans vérifier les prérequis (matériaux, engins) ne sert à rien : le rituel du vendredi inclut la logistique. Lundi 7h, tout le monde sait quoi faire ET peut le faire." },
  },

  // ───────────────────────── f1 — priorisation ─────────────────────────
  {
    variantOf: "final:f1", angle: "banque/finance", subArea: "priorisation",
    question: { id: "f1v1", subArea: "priorisation", scenarioText: "Lundi 8h, banque à Bamako : 7 tâches, dont 3 « urgentes » réclamées par des collègues (relances, tableau, réunion à préparer) et 2 importantes pour vos objectifs annuels (dossiers de financement PME). Par quoi commencez-vous ?", options: [
      { key: "A", label: "Les 3 urgences des collègues — pour être tranquille ensuite." },
      { key: "B", label: "Un des deux dossiers PME, le plus structurant, pendant mes meilleures heures." },
      { key: "C", label: "Mes emails, pour vérifier qu'il n'y a rien de nouveau." },
      { key: "D", label: "La tâche la plus rapide de la liste." },
    ], correctKey: "B", feedbackText: "Les objectifs annuels se gagnent le lundi matin. Les « urgences » de collègues survivent presque toujours à 2 heures d'attente — vos dossiers structurants, eux, ne survivent pas à des semaines de report." },
  },
  {
    variantOf: "final:f1", angle: "ONG/projet", subArea: "priorisation",
    question: { id: "f1v2", subArea: "priorisation", scenarioText: "Lundi 8h au bureau de l'ONG à Goma : 9 tâches, dont 3 étiquetées « urgent » par des collègues (logistique d'un atelier, relecture d'un email sensible, achat de fournitures) et 2 critiques pour la mission (cadre logique de la phase 2, données pour le bailleur). Première action ?", options: [
      { key: "A", label: "L'achat de fournitures — vite réglé." },
      { key: "B", label: "Le cadre logique de la phase 2 : 2 heures de concentration immédiate." },
      { key: "C", label: "Les trois urgences dans l'ordre d'arrivée." },
      { key: "D", label: "Lecture complète des messages du week-end." },
    ], correctKey: "B", feedbackText: "Le cadre logique conditionne le financement de la phase 2 — c'est l'important de la semaine. Les urgences déclarées des collègues trouvent leur place APRÈS le bloc de concentration, pas à sa place." },
  },
  {
    variantOf: "final:f1", angle: "industrie/atelier", subArea: "priorisation",
    question: { id: "f1v3", subArea: "priorisation", scenarioText: "Lundi 7h30, usine textile à Antsirabe : 8 points en attente, dont 3 « urgents » (bourrage machine réglé mais à documenter, appel du transporteur, badge d'un intérimaire) et 2 majeurs (plan de production du trimestre, dossier de certification qualité). Par quoi commencez-vous ?", options: [
      { key: "A", label: "Le badge de l'intérimaire — deux minutes." },
      { key: "B", label: "Le tour d'atelier puis les 3 urgences." },
      { key: "C", label: "Le plan de production du trimestre, porte fermée jusqu'à 9h30." },
      { key: "D", label: "L'appel du transporteur, puis on verra." },
    ], correctKey: "C", feedbackText: "Le plan trimestriel détermine la charge de toute l'usine ; aucun des 3 « urgents » ne se dégrade en 2 heures. Les premières heures du lundi appartiennent à ce qui engage le trimestre." },
  },
  {
    variantOf: "final:f1", angle: "télétravail/numérique", subArea: "priorisation",
    question: { id: "f1v4", subArea: "priorisation", scenarioText: "Lundi 8h, consultante à distance (clients à Dakar et Bruxelles) : 8 tâches, dont 3 « urgentes » venues de messages du week-end et 2 déterminantes pour votre activité (offre pour un appel d'offres, préparation de l'atelier client de mercredi). Par quoi ouvrez-vous la semaine ?", options: [
      { key: "A", label: "Le tri complet de la boîte mail du week-end." },
      { key: "B", label: "L'offre pour l'appel d'offres : 2 heures de rédaction avant toute messagerie." },
      { key: "C", label: "Les 3 urgences du week-end, par politesse." },
      { key: "D", label: "L'atelier de mercredi — c'est le plus proche dans le temps." },
    ], correctKey: "B", feedbackText: "Ouvrir la messagerie en premier, c'est offrir ses meilleures heures aux priorités des autres. L'offre engage votre chiffre d'affaires : elle passe d'abord ; les messages du week-end à 10h30." },
  },

  // ───────────────────────── f2 — urgences imposées (« oui différent ») ─────────────────────────
  {
    variantOf: "final:f2", angle: "administration publique", subArea: "urgences imposées",
    question: { id: "f2v1", subArea: "urgences imposées", scenarioText: "21h45, message du directeur de cabinet (ministère à Libreville) : la note de synthèse prévue pour vendredi est exigée demain 8h30 pour une réunion imprévue. Elle est à 55 %.", options: [
      { key: "A", label: "Je passe la nuit dessus pour la rendre complète." },
      { key: "B", label: "J'envoie ce qui existe, tel quel, à 23h." },
      { key: "C", label: "Je propose pour 8h30 une synthèse de 2 pages sur l'essentiel, la version complète restant due vendredi." },
      { key: "D", label: "Je n'ouvre le message que demain à 7h30." },
    ], correctKey: "C", feedbackText: "Le « oui différent » : répondre au vrai besoin de 8h30 (de quoi décider en réunion) sans sacrifier ni la nuit ni la qualité du livrable final. C'est celui qui propose qui garde la maîtrise." },
  },
  {
    variantOf: "final:f2", angle: "startup tech", subArea: "urgences imposées",
    question: { id: "f2v2", subArea: "urgences imposées", scenarioText: "22h, Slack du CEO (startup à Lagos) : un investisseur veut voir le dashboard des métriques « demain matin 9h » au lieu de la démo prévue vendredi. Le dashboard est à 60 %.", options: [
      { key: "A", label: "Nuit blanche pour tout finir." },
      { key: "B", label: "Je réponds : à 9h il aura les 4 métriques clés en version stable ; le dashboard complet reste pour vendredi comme convenu." },
      { key: "C", label: "Je montre demain le dashboard à 60 % avec ses bugs." },
      { key: "D", label: "Je propose de repousser la rencontre investisseur." },
    ], correctKey: "B", feedbackText: "Un investisseur à 9h a besoin de signal, pas d'exhaustivité. Le périmètre réduit et STABLE protège l'image de l'équipe ; la nuit blanche produit des démos qui plantent." },
  },
  {
    variantOf: "final:f2", angle: "santé/clinique", subArea: "urgences imposées",
    question: { id: "f2v3", subArea: "urgences imposées", scenarioText: "21h15, appel de la directrice de la clinique (Abidjan) : l'inspection régionale passe demain 8h ; elle veut le rapport d'hygiène complet prévu pour vendredi. Il est à 65 %.", options: [
      { key: "A", label: "Je retourne à la clinique pour la nuit." },
      { key: "B", label: "Je promets le rapport complet pour 8h en espérant y arriver." },
      { key: "C", label: "Je propose pour 8h le dossier des points contrôlés par l'inspection (les 65 % couvrent l'essentiel), le rapport complet restant pour vendredi." },
      { key: "D", label: "Je suggère de dire à l'inspection que le rapport est « en cours »." },
    ], correctKey: "C", feedbackText: "Face à une échéance imposée, on négocie le PÉRIMÈTRE, pas la qualité : ce dont l'inspection a besoin demain existe déjà. Promettre l'impossible (B) est le vrai risque professionnel." },
  },
  {
    variantOf: "final:f2", angle: "commerce/distribution", subArea: "urgences imposées",
    question: { id: "f2v4", subArea: "urgences imposées", scenarioText: "21h30, WhatsApp du propriétaire de la chaîne (Dakar) : il veut « demain 8h » le bilan des ventes du trimestre prévu pour vendredi, car un acheteur potentiel visite le magasin. Le bilan est à 60 %.", options: [
      { key: "A", label: "Je travaille jusqu'à 3h du matin pour tout boucler." },
      { key: "B", label: "Je propose pour 8h une synthèse d'une page (CA, marge, top produits) — le bilan détaillé suivant vendredi." },
      { key: "C", label: "J'envoie le fichier inachevé avec ses onglets vides." },
      { key: "D", label: "Je réponds que ce n'était pas prévu pour demain." },
    ], correctKey: "B", feedbackText: "L'acheteur veut une impression fiable, pas 40 onglets. La synthèse d'une page répond mieux au vrai besoin que le fichier complet bâclé — et vous arrivez frais à la visite." },
  },

  // ───────────────────────── f3 — interruptions ─────────────────────────
  {
    variantOf: "final:f3", angle: "banque/finance", subArea: "interruptions",
    question: { id: "f3v1", subArea: "interruptions", scenarioText: "Salle de crédit d'une banque à Kigali : votre créneau focus (affiché dans l'agenda partagé) court jusqu'à 11h. À 10h20, une collègue entre pour un dossier sans échéance aujourd'hui.", options: [
      { key: "A", label: "Je traite sa demande immédiatement." },
      { key: "B", label: "Je signale mon créneau et lui propose 11h10 précises." },
      { key: "C", label: "Je continue à travailler sans lever la tête." },
      { key: "D", label: "Je lui suggère de voir quelqu'un d'autre." },
    ], correctKey: "B", feedbackText: "Signal + alternative concrète dans l'heure : le focus est protégé et la collègue repart avec un rendez-vous, pas un refus. C'est la mécanique de base qui rend les créneaux crédibles." },
  },
  {
    variantOf: "final:f3", angle: "administration publique", subArea: "interruptions",
    question: { id: "f3v2", subArea: "interruptions", scenarioText: "Mairie de Kaolack : vous rédigez une délibération pendant votre plage de concentration connue du service. Un agent entre pour discuter d'un dossier d'état civil qui peut attendre demain.", options: [
      { key: "A", label: "Je m'interromps — le service public, c'est l'accueil." },
      { key: "B", label: "Je lui indique ma plage en cours et lui fixe 15h30 aujourd'hui même." },
      { key: "C", label: "Je le renvoie sans autre forme." },
      { key: "D", label: "Je l'écoute en continuant à rédiger la délibération." },
    ], correctKey: "B", feedbackText: "La délibération interrompue, c'est une erreur juridique possible. Le rendez-vous ferme à 15h30 honore l'agent ET le texte — l'écoute distraite (D) rate les deux." },
  },
  {
    variantOf: "final:f3", angle: "éducation/formation", subArea: "interruptions",
    question: { id: "f3v3", subArea: "interruptions", scenarioText: "Université à Saint-Louis : vous corrigez des mémoires pendant votre créneau annoncé aux étudiants (14h–16h, porte fermée). Un étudiant frappe pour discuter de son sujet — soutenance dans 2 mois.", options: [
      { key: "A", label: "Je le reçois — un étudiant motivé, ça s'encourage." },
      { key: "B", label: "Je lui rappelle le créneau et lui propose demain 10h, ou l'heure de permanence de 16h." },
      { key: "C", label: "Je lui dis de m'écrire un email." },
      { key: "D", label: "Je le reçois « 5 minutes » qui deviendront 45." },
    ], correctKey: "B", feedbackText: "Un sujet à 2 mois n'a rien d'urgent. L'alternative précise (demain 10h ou la permanence) éduque toute la promotion au respect du cadre — et vos corrections gardent leur qualité." },
  },
  {
    variantOf: "final:f3", angle: "logistique/transport", subArea: "interruptions",
    question: { id: "f3v4", subArea: "interruptions", scenarioText: "Port de Cotonou : vous montez le plan de chargement de demain pendant votre créneau signalé à l'équipe. Un transitaire entre pour parler d'une expédition de la semaine prochaine.", options: [
      { key: "A", label: "Je pose le plan de chargement et le reçois." },
      { key: "B", label: "Je lui indique mon créneau et lui propose 16h ou demain 8h, à son choix." },
      { key: "C", label: "Je lui demande de repasser « plus tard »." },
      { key: "D", label: "Je l'écoute tout en continuant le plan — quitte à me tromper de travée." },
    ], correctKey: "B", feedbackText: "Une erreur dans un plan de chargement coûte des heures de manutention. Le choix entre deux créneaux précis (16h / demain 8h) est encore plus respectueux qu'un seul — et le plan reste juste." },
  },

  // ───────────────────────── f4 — planification / buffer ─────────────────────────
  {
    variantOf: "final:f4", angle: "ONG/projet", subArea: "planification",
    question: { id: "f4v1", subArea: "planification", scenarioText: "Semaine de 40 h dans une ONG à Mopti, contexte à forte imprévisibilité (sécurité, déplacements, sollicitations communautaires). Combien d'heures maximum planifiez-vous en tâches fermes ?", options: [
      { key: "A", label: "40 h — le projet a besoin de chaque heure." },
      { key: "B", label: "36 h — 4 h de réserve suffisent." },
      { key: "C", label: "≈ 28 h — 30 % de buffer pour les imprévus structurels." },
      { key: "D", label: "15 h — dans ce contexte, planifier plus est illusoire." },
    ], correctKey: "C", feedbackText: "30 % de 40 h = 12 h de buffer : c'est ce qui absorbe escortes retardées et réunions communautaires imprévues sans détruire les 28 h d'engagements fermes. 4 h (B) fond dès mardi." },
  },
  {
    variantOf: "final:f4", angle: "BTP/chantier", subArea: "planification",
    question: { id: "f4v2", subArea: "planification", scenarioText: "Vous planifiez 50 h de conduite de travaux hebdomadaire sur un chantier à Brazzaville (pluies, livraisons aléatoires, pannes d'engins fréquentes). Combien d'heures en tâches programmées fermes ?", options: [
      { key: "A", label: "50 h — un chantier n'attend pas." },
      { key: "B", label: "≈ 35 h — 30 % de marge pour les aléas du chantier." },
      { key: "C", label: "45 h — 5 h de marge, c'est déjà bien." },
      { key: "D", label: "25 h — la moitié, par prudence extrême." },
    ], correctKey: "B", feedbackText: "30 % de 50 h = 15 h de marge : l'ordre de grandeur qui encaisse une pluie + une panne + une livraison ratée LA MÊME semaine. 10 % (C) ne survit pas à un seul de ces aléas." },
  },
  {
    variantOf: "final:f4", angle: "startup tech", subArea: "planification",
    question: { id: "f4v3", subArea: "planification", scenarioText: "Sprint d'équipe de 2 semaines dans votre startup à Kigali, soit 300 h-personne. L'historique montre bugs de prod et demandes clients imprévues chaque sprint. Combien d'heures engagez-vous sur les tickets planifiés ?", options: [
      { key: "A", label: "300 h — l'engagement crée la performance." },
      { key: "B", label: "≈ 210 h — 30 % de capacité gardée pour la prod et l'imprévu." },
      { key: "C", label: "280 h — 20 h pour les bugs, c'est large." },
      { key: "D", label: "150 h — la moitié, pour être tranquille." },
    ], correctKey: "B", feedbackText: "Un sprint chargé à 100 % échoue au premier bug de prod — et l'historique dit qu'il y en aura. 30 % de capacité tampon, c'est la différence entre un engagement tenu et un rituel d'excuses." },
  },
  {
    variantOf: "final:f4", angle: "commerce/distribution", subArea: "planification",
    question: { id: "f4v4", subArea: "planification", scenarioText: "Gérante à Ouagadougou : votre semaine fait 48 h, entre gestion du magasin et développement (fournisseurs, nouveau local). Les imprévus clients et livraisons sont quotidiens. Combien d'heures planifiez-vous fermement ?", options: [
      { key: "A", label: "48 h — tout planifier pour tout contrôler." },
      { key: "B", label: "44 h — l'imprévu se gérera au fil de l'eau." },
      { key: "C", label: "≈ 33 h — 30 % de coussin pour le quotidien imprévisible du commerce." },
      { key: "D", label: "20 h — le commerce ne se planifie pas." },
    ], correctKey: "C", feedbackText: "≈ 15 h de coussin hebdomadaire : c'est ce qui permet aux rendez-vous fournisseurs et au dossier du local d'être TENUS malgré les urgences de la boutique. Sans coussin, le développement recule chaque semaine." },
  },

  // ───────────────────────── f5 — délégation (draft insuffisant) ─────────────────────────
  {
    variantOf: "final:f5", angle: "banque/finance", subArea: "délégation",
    question: { id: "f5v1", subArea: "délégation", scenarioText: "La première analyse de risque rédigée par votre jeune analyste (banque à Douala) est très en dessous du niveau attendu : structure confuse, ratios mal interprétés.", options: [
      { key: "A", label: "Je réécris l'analyse moi-même cette nuit." },
      { key: "B", label: "Je bloque 30 minutes avec elle : points forts, 2 lacunes majeures, et une v2 attendue jeudi." },
      { key: "C", label: "Je lui renvoie le document truffé de commentaires rouges." },
      { key: "D", label: "Je confie les prochaines analyses à quelqu'un d'autre." },
    ], correctKey: "B", feedbackText: "Un premier jet faible est une étape normale de la délégation, pas son échec. Les 30 minutes de revue orale + v2 datée construisent l'analyste ; le document rouge (C) construit surtout sa peur." },
  },
  {
    variantOf: "final:f5", angle: "ONG/projet", subArea: "délégation",
    question: { id: "f5v2", subArea: "délégation", scenarioText: "Le premier rapport d'activité rédigé par votre assistant de projet (Bamako) est insuffisant : données non vérifiées, sections manquantes. Le bailleur l'attend dans une semaine.", options: [
      { key: "A", label: "Je le réécris entièrement ce week-end." },
      { key: "B", label: "Je programme 45 minutes de relecture commune : ce qui tient, ce qui manque, et une v2 sous 72h — que je relirai." },
      { key: "C", label: "Je lui renvoie un email listant les 23 problèmes." },
      { key: "D", label: "J'informe le coordinateur que l'assistant n'est pas prêt." },
    ], correctKey: "B", feedbackText: "Une semaine de marge permet exactement un cycle coaching → v2 → relecture. Le réécrire vous-même (A) garantit que le prochain rapport sera aussi le vôtre — pour toujours." },
  },
  {
    variantOf: "final:f5", angle: "industrie/atelier", subArea: "délégation",
    question: { id: "f5v3", subArea: "délégation", scenarioText: "Vous avez confié à un jeune technicien (usine à Sfax) la rédaction des fiches d'entretien préventif. Sa première fiche est incomplète et parfois fausse sur les fréquences de graissage.", options: [
      { key: "A", label: "Je rédige les fiches moi-même dorénavant." },
      { key: "B", label: "Trente minutes ensemble devant la machine : corriger la fiche en situation réelle, puis il refait les 3 suivantes seul pour vendredi." },
      { key: "C", label: "Je lui remets le manuel constructeur de 400 pages." },
      { key: "D", label: "Je fais valider chaque fiche par le chef d'équipe avant moi." },
    ], correctKey: "B", feedbackText: "La correction EN SITUATION (devant la machine) est la pédagogie la plus dense qui soit — 30 minutes valent 3 relectures. Et les 3 fiches suivantes en autonomie transforment la leçon en compétence." },
  },
  {
    variantOf: "final:f5", angle: "éducation/formation", subArea: "délégation",
    question: { id: "f5v4", subArea: "délégation", scenarioText: "Le jeune formateur que vous encadrez (centre à Thiès) a animé sa première session seul : les évaluations des participants sont médiocres (rythme confus, exercices mal expliqués).", options: [
      { key: "A", label: "Je reprends l'animation de toutes les sessions." },
      { key: "B", label: "Débriefing de 30 minutes : deux forces, deux axes précis, et je m'assois au fond de sa prochaine session avant de le relancer seul." },
      { key: "C", label: "Je lui transmets les évaluations brutes sans commentaire." },
      { key: "D", label: "Je l'inscris à une formation de formateurs de 3 semaines." },
    ], correctKey: "B", feedbackText: "Deux forces + deux axes + une observation bienveillante : le cycle court qui fabrique un formateur. Les évaluations brutes sans cadre (C) découragent ; la reprise en main (A) gaspille votre investissement." },
  },

  // ───────────────────────── f6 — rituels (abandon récurrent) ─────────────────────────
  {
    variantOf: "final:f6", angle: "banque/finance", subArea: "rituels",
    question: { id: "f6v1", subArea: "rituels", scenarioText: "Vous abandonnez systématiquement votre revue hebdomadaire du portefeuille clients, prévue le vendredi 17h (agence à Lomé), « parce qu'il y a toujours autre chose ». Quelle lecture en faites-vous ?", options: [
      { key: "A", label: "Je manque de rigueur — me forcer davantage." },
      { key: "B", label: "Le créneau est mauvais : vendredi 17h est une heure morte de volonté ; tester mardi 8h30." },
      { key: "C", label: "Cette revue est inutile puisque je m'en passe chaque semaine." },
      { key: "D", label: "Il me faut un assistant pour la faire à ma place." },
    ], correctKey: "B", feedbackText: "Un rituel qui saute TOUJOURS au même créneau accuse le créneau, pas la personne. Déplacé vers une heure de haute énergie (mardi 8h30), le même rituel tient souvent sans effort supplémentaire." },
  },
  {
    variantOf: "final:f6", angle: "santé/clinique", subArea: "rituels",
    question: { id: "f6v2", subArea: "rituels", scenarioText: "Votre point hebdomadaire de suivi des stocks de médicaments (centre de santé à Zinder), prévu le samedi midi, saute une semaine sur deux depuis 2 mois. Diagnostic ?", options: [
      { key: "A", label: "L'équipe n'est pas assez disciplinée." },
      { key: "B", label: "Le samedi midi est structurellement mauvais (affluence, fatigue) : déplacer le point au mercredi 7h30, avant l'ouverture." },
      { key: "C", label: "Le suivi hebdomadaire est trop fréquent — passer au mensuel." },
      { key: "D", label: "Il faut une prime pour motiver le point stock." },
    ], correctKey: "B", feedbackText: "Avant d'accuser la discipline ou de réduire la fréquence (dangereux pour des médicaments), on déplace le rituel vers un créneau protégé par nature : avant l'ouverture, l'affluence ne peut pas le manger." },
  },
  {
    variantOf: "final:f6", angle: "startup tech", subArea: "rituels",
    question: { id: "f6v3", subArea: "rituels", scenarioText: "Votre rétrospective d'équipe du vendredi 16h30 (startup à Dakar) est écourtée ou annulée 3 fois sur 4 depuis le début du trimestre. Que conclure ?", options: [
      { key: "A", label: "L'équipe ne croit pas à l'agilité." },
      { key: "B", label: "Le créneau est condamné (fin de semaine, démos client fréquentes) : basculer la rétro au mardi 11h30, avant le déjeuner." },
      { key: "C", label: "Supprimer la rétro et traiter les problèmes au fil de l'eau." },
      { key: "D", label: "La rendre obligatoire par une règle écrite." },
    ], correctKey: "B", feedbackText: "Un rituel annulé 3 fois sur 4 n'a pas un problème d'adhésion mais de créneau. Mardi 11h30 : énergie disponible, aucune démo, et le déjeuner fait office de butoir naturel qui garde la rétro courte." },
  },
  {
    variantOf: "final:f6", angle: "commerce/distribution", subArea: "rituels",
    question: { id: "f6v4", subArea: "rituels", scenarioText: "Votre analyse hebdomadaire des ventes (boutiques à Marrakech), prévue le samedi 20h après la fermeture, n'a pas été faite depuis 5 semaines. Quelle est la bonne lecture ?", options: [
      { key: "A", label: "Je ne suis pas fait pour les chiffres." },
      { key: "B", label: "Samedi 20h, après 11h de magasin, est le pire créneau possible : passer au lundi 8h, magasin fermé, esprit frais." },
      { key: "C", label: "L'analyse hebdo est superflue — le comptable fait déjà le mensuel." },
      { key: "D", label: "Il faut la faire à deux pour se motiver." },
    ], correctKey: "B", feedbackText: "On ne construit pas un rituel d'analyse sur des ruines d'énergie. Lundi 8h : même durée, même contenu, zéro fatigue accumulée — le rituel devient soutenable, donc réel." },
  },

  // ───────────────────────── f7 — clarification avant exécution ─────────────────────────
  {
    variantOf: "final:f7", angle: "banque/finance", subArea: "urgences imposées",
    question: { id: "f7v1", subArea: "urgences imposées", scenarioText: "Lundi, agence à Niamey. Le directeur régional vous confie « un point complet sur le portefeuille PME pour vendredi ». Vous avez déjà 3 priorités cette semaine. Première action ?", options: [
      { key: "A", label: "Demander 10 minutes pour cadrer : périmètre exact, format (note ? présentation ?), destinataires, heure de remise vendredi." },
      { key: "B", label: "Commencer l'extraction des données dès cet après-midi." },
      { key: "C", label: "Le caser jeudi et improviser si besoin." },
      { key: "D", label: "Le confier à l'analyste junior." },
    ], correctKey: "A", feedbackText: "« Point complet » peut signifier 2 pages ou 40. Dix minutes de cadrage évitent trois jours d'extraction dans la mauvaise direction — la clarification est la première tâche, pas une option." },
  },
  {
    variantOf: "final:f7", angle: "ONG/projet", subArea: "urgences imposées",
    question: { id: "f7v2", subArea: "urgences imposées", scenarioText: "Lundi, la représentante pays (ONG à N'Djamena) vous demande « quelque chose sur nos résultats pour la visite du siège vendredi ». Vous portez déjà 3 dossiers chauds. Que faites-vous en premier ?", options: [
      { key: "A", label: "Je compile toutes les données de l'année, on triera après." },
      { key: "B", label: "Je demande 10 minutes : quel format (slides ? poster ? fiche ?), quelle durée, quels messages clés elle veut porter." },
      { key: "C", label: "Je planifie la rédaction pour jeudi soir." },
      { key: "D", label: "Je ressers la présentation du trimestre dernier." },
    ], correctKey: "B", feedbackText: "« Quelque chose sur nos résultats » est un brief fantôme. Les 3 questions (format, durée, messages) transforment une semaine d'angoisse en 3 heures de production ciblée mercredi." },
  },
  {
    variantOf: "final:f7", angle: "industrie/atelier", subArea: "urgences imposées",
    question: { id: "f7v3", subArea: "urgences imposées", scenarioText: "Lundi matin, le directeur d'usine (Abidjan) lance en passant : « Préparez-moi la visite du groupe pour vendredi. » Vous gérez déjà la maintenance annuelle cette semaine. Première action ?", options: [
      { key: "A", label: "Faire briller toute l'usine dès aujourd'hui." },
      { key: "B", label: "Obtenir 10 minutes avec lui : qui vient, quel circuit de visite, quels ateliers montrer, quelle heure exacte." },
      { key: "C", label: "Prévoir la préparation jeudi après-midi." },
      { key: "D", label: "Déléguer la préparation au chef de ligne." },
    ], correctKey: "B", feedbackText: "Préparer une visite sans connaître le circuit ni les visiteurs, c'est nettoyer les mauvais ateliers. Dix minutes de cadrage lundi rendent la préparation compatible avec la maintenance." },
  },
  {
    variantOf: "final:f7", angle: "télétravail/numérique", subArea: "urgences imposées",
    question: { id: "f7v4", subArea: "urgences imposées", scenarioText: "Lundi, message laconique de votre cliente principale (vous êtes freelance à Tunis) : « Il me faudrait un audit de notre site pour vendredi. » Trois livrables occupent déjà votre semaine. Première action ?", options: [
      { key: "A", label: "Lancer les outils d'analyse et tout auditer (SEO, perf, sécurité, contenu)." },
      { key: "B", label: "Proposer 15 minutes d'appel : audit de quoi précisément, pour quelle décision, quel niveau de détail, quel budget temps." },
      { key: "C", label: "Bloquer jeudi entier et voir jusqu'où je vais." },
      { key: "D", label: "Envoyer un devis forfaitaire sans échanger." },
    ], correctKey: "B", feedbackText: "« Audit » sans périmètre = engagement illimité. L'appel de cadrage protège votre semaine, dimensionne l'effort au vrai besoin (souvent : la performance avant une campagne) et professionnalise la relation." },
  },

  // ───────────────────────── f8 — buffer insuffisant / analyse ─────────────────────────
  {
    variantOf: "final:f8", angle: "banque/finance", subArea: "planification",
    question: { id: "f8v1", subArea: "planification", scenarioText: "Votre semaine planifiée en agence (Bamako) vient d'être pulvérisée par 3 urgences majeures : contrôle interne surprise, panne du système, VIP mécontent. Que dit cet épisode de votre système ?", options: [
      { key: "A", label: "Mon système a échoué — revenir au pilotage à vue." },
      { key: "B", label: "Mon buffer était trop faible : le monter à 35–40 % et vérifier lesquelles de ces « surprises » étaient prévisibles (le contrôle interne l'était)." },
      { key: "C", label: "Les semaines de banquier sont ingérables par nature." },
      { key: "D", label: "Il me faut un adjoint pour filtrer les urgences." },
    ], correctKey: "B", feedbackText: "Trois urgences non absorbées = buffer sous-dimensionné, pas système invalide. Et l'analyse rétrospective révèle presque toujours qu'une « surprise » sur deux était datée quelque part (le contrôle interne a un calendrier)." },
  },
  {
    variantOf: "final:f8", angle: "ONG/projet", subArea: "planification",
    question: { id: "f8v2", subArea: "planification", scenarioText: "Semaine explosée au bureau de Goma : mission bailleur avancée, panne du groupe électrogène, atelier communautaire déplacé. Votre planning n'a pas survécu à mardi. Diagnostic selon la méthode ?", options: [
      { key: "A", label: "Dans l'humanitaire, planifier ne sert à rien." },
      { key: "B", label: "Buffer insuffisant : passer à 35–40 % et noter que la panne du groupe (3e fois ce trimestre) n'est plus un imprévu — c'est une maintenance à planifier." },
      { key: "C", label: "Mon coordinateur doit valider mon planning pour le protéger." },
      { key: "D", label: "Travailler les week-ends pour compenser structurellement." },
    ], correctKey: "B", feedbackText: "L'« imprévu » récurrent est un problème de fond déguisé : la 3e panne du groupe se planifie (maintenance), elle ne s'absorbe pas. Le buffer encaisse le vrai hasard ; l'analyse élimine le faux." },
  },
  {
    variantOf: "final:f8", angle: "logistique/transport", subArea: "planification",
    question: { id: "f8v3", subArea: "planification", scenarioText: "Votre semaine de responsable logistique (Mombasa) a été balayée par 3 crises : navire en retard, grève partielle des dockers, camion en panne. Que faut-il conclure pour votre système de planification ?", options: [
      { key: "A", label: "La logistique portuaire ne se planifie pas, elle se subit." },
      { key: "B", label: "Monter le buffer à 35–40 % ET traiter les récurrences : les retards navires ont une saisonnalité, la flotte camions a un âge — deux choses anticipables." },
      { key: "C", label: "Changer de métier de planification : passer au jour le jour." },
      { key: "D", label: "Doubler les effectifs pour absorber les crises." },
    ], correctKey: "B", feedbackText: "Le réflexe en deux temps : dimensionner le tampon à la réalité du port (35–40 %) ET requalifier les « crises » récurrentes en phénomènes prévisibles (saisonnalité, vieillissement). C'est là que le système apprend." },
  },
  {
    variantOf: "final:f8", angle: "éducation/formation", subArea: "planification",
    question: { id: "f8v4", subArea: "planification", scenarioText: "Directrice d'école à Porto-Novo : votre semaine a été dévorée par 3 imprévus majeurs — inspection académique, fuite d'eau, conflit entre parents. Votre planification était réduite en miettes dès mercredi. Quelle conclusion ?", options: [
      { key: "A", label: "Une école ne se dirige qu'en réaction." },
      { key: "B", label: "Augmenter le buffer à 35–40 % et objectiver : l'inspection était annoncée au trimestre, la plomberie vieillit — deux « imprévus » sur trois étaient anticipables." },
      { key: "C", label: "Déléguer toute la planification à l'adjoint." },
      { key: "D", label: "Arriver à 6h chaque matin pour prendre de l'avance." },
    ], correctKey: "B", feedbackText: "Le tri anticipable/aléatoire est le geste clé : l'inspection se prépare, la plomberie s'entretient, seul le conflit parental relevait du vrai hasard. Un bon buffer n'a à absorber QUE le hasard réel." },
  },
];
