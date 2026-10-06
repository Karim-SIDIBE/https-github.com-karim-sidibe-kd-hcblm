/**
 * annexe-communication-n1.ts — grille certifiante officielle du parcours
 * « Communication professionnelle en Environnements Professionnels Africains »
 * Niveau 1.
 *
 * Source : Annexe de parcours Communication professionnelle N1 v1.0
 * (novembre 2026, conforme Gabarit v1.2 · Référentiel v3.0 · socle commun
 * v1.1 + avenant n° 1) — transmise le 07/10/2026. L'annexe fixe les quatre
 * critères du domaine D1 (pondérations, minima, emplacement des preuves,
 * descripteurs de bande, repris mot pour mot) ; les critères S1-S3 viennent
 * du socle commun v1.1, identiques à ceux de la grille canonique Gestion du
 * Temps (le socle est commun à tous les parcours).
 *
 * Contrôle de non-compensation (annexe §2) : somme des minimums 40 + bloc
 * libre 25 = 65 points au maximum en atteignant tout juste les minimums,
 * sous le seuil de certification à 70 — un candidat ne compense pas des
 * compétences D1 non démontrées par de la contextualisation/réflexivité.
 *
 * Ordre de notation (annexe §2.2) : critères 1 à 4, puis S1, S2, S3.
 * Non-chevauchement (annexe §2.2) : S1 lit la régularité/complétude des six
 * micro-entrées ; D1.C4 lit le CONTENU de J+2, J+6 et J+11.
 */
import type { Rubric } from "../content-model.js";

export const annexeCommunicationN1Rubric: Rubric = {
  criteria: [
    {
      label: "Clarté et structuration du message", competencyCode: "D1.C1", weightPoints: 15, origin: "annexe", minPoints: 8,
      whereToLook: "Sections 2 et 3",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Rapporte au moins deux interventions réelles de la période de pratique, datées, et cite pour chacune l'objectif tel qu'il l'a annoncé en ouverture. Indique si l'échange est resté sur cet objectif. Nomme au moins un moment où l'échange a dérivé et cite ce qu'il a dit pour y revenir." },
        { band: 3, scoreRange: [9, 12], descriptor: "Rapporte une intervention datée et cite l'objectif annoncé en ouverture, en indiquant si l'échange s'y est tenu, sans décrire de dérive ni de retour à l'objectif." },
        { band: 2, scoreRange: [6, 8], descriptor: "Décrit ses interventions sans citer d'objectif annoncé, ou cite un objectif sans dire s'il a été tenu." },
        { band: 1, scoreRange: [0, 5], descriptor: "Aucune situation réelle rapportée, ou reprise générique du vocabulaire du parcours sans situation propre au candidat." },
      ],
    },
    {
      label: "Écoute active et reformulation", competencyCode: "D1.C2", weightPoints: 15, origin: "annexe", minPoints: 8,
      whereToLook: "Sections 1, 2 et 3",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Rapporte au moins deux consignes ou demandes reçues pendant la période, datées, et cite la reformulation qu'il en a faite. Indique ce que la reformulation a fait apparaître : un point confirmé ou un malentendu corrigé. Nomme au moins une demande dont la reformulation a changé ce qu'il a fait ensuite." },
        { band: 3, scoreRange: [9, 12], descriptor: "Rapporte une demande datée et cite la reformulation qu'il en a faite, sans indiquer ce qu'elle a fait apparaître." },
        { band: 2, scoreRange: [6, 8], descriptor: "Affirme reformuler les consignes sans citer de reformulation réelle, ou cite une reprise mot pour mot de la demande." },
        { band: 1, scoreRange: [0, 5], descriptor: "Aucune situation réelle rapportée, ou reprise générique du vocabulaire du parcours sans situation propre au candidat." },
      ],
    },
    {
      label: "Prise de parole et impact", competencyCode: "D1.C3", weightPoints: 15, origin: "annexe", minPoints: 8,
      whereToLook: "Sections 2 et 3",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Rapporte au moins une présentation d'idée faite devant un petit groupe pendant la période, avec la date, le public par fonction et la durée, sans support. Cite l'idée telle qu'il l'a formulée en une phrase. Rapporte une question ou une objection reçue et ce qu'il a répondu. Indique la suite donnée par le groupe." },
        { band: 3, scoreRange: [9, 12], descriptor: "Rapporte une présentation datée devant un petit groupe, sans support, et cite l'idée présentée, sans question reçue ni suite donnée." },
        { band: 2, scoreRange: [6, 8], descriptor: "Rapporte une présentation faite en s'appuyant sur un support écrit ou projeté, ou devant un seul interlocuteur." },
        { band: 1, scoreRange: [0, 5], descriptor: "Aucune situation réelle rapportée, ou reprise générique du vocabulaire du parcours sans situation propre au candidat." },
      ],
    },
    {
      label: "Communication écrite professionnelle", competencyCode: "D1.C4", weightPoints: 15, origin: "annexe", minPoints: 8,
      whereToLook: "Micro-entrées J+2, J+6 et J+11 du journal de pratique, pour leur contenu",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Les trois micro-entrées reproduisent chacune les trois premières lignes d'un message réellement envoyé, avec sa date et la fonction du destinataire. Dans chacun, l'objet, la demande et l'échéance sont identifiables dès ces trois lignes. Au moins un message porte une demande difficile : un refus, une relance ou le signalement d'un retard." },
        { band: 3, scoreRange: [9, 12], descriptor: "Les trois messages sont reproduits et datés, mais l'un des trois éléments manque dans l'un d'eux, ou n'apparaît qu'au-delà des trois premières lignes." },
        { band: 2, scoreRange: [6, 8], descriptor: "Deux messages seulement sont reproduits, ou les messages ne portent pas d'échéance." },
        { band: 1, scoreRange: [0, 5], descriptor: "Aucun message réel n'est reproduit, ou les textes ont été rédigés pour l'exercice sans destinataire." },
      ],
    },
    // --- Socle commun v1.1 (S1-S3) — identique à la grille canonique ---
    {
      label: "S1 — Régularité de la pratique et journal", competencyCode: "", weightPoints: 15, origin: "socle", minPoints: 8,
      whereToLook: "Journal de pratique (6 micro-entrées, J+2 à J+15) et section apprentissage personnel",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Les 6 entrées sont présentes et réparties sur les 15 jours, sans rattrapage groupé de plus de deux entrées le même jour. Le candidat décrit un signal de surcharge ou de décrochage qu'il a repéré chez lui et l'ajustement concret qu'il a fait en réponse." },
        { band: 3, scoreRange: [9, 12], descriptor: "Les 6 entrées sont présentes. Le candidat mentionne sa charge de travail ou sa charge mentale et un ajustement, sans décrire le signal qui l'a déclenché." },
        { band: 2, scoreRange: [5, 8], descriptor: "4 ou 5 entrées présentes, ou 6 entrées rattrapées en une seule fois. La charge est évoquée sans ajustement décrit." },
        { band: 1, scoreRange: [0, 4], descriptor: "Moins de 4 entrées, ou aucune mention de la charge de travail ni de la charge mentale." },
      ],
    },
    {
      label: "S2 — Profondeur de l'apprentissage personnel", competencyCode: "", weightPoints: 15, origin: "socle",
      whereToLook: "Section apprentissage personnel et journal de pratique",
      bands: [
        { band: 4, scoreRange: [13, 15], descriptor: "Nomme une croyance ou une habitude qu'il a révisée et indique ce qui l'a fait changer d'avis. Cite au moins une chose qui n'a pas fonctionné et analyse la raison de cet échec. Formule ce qu'il fera différemment." },
        { band: 3, scoreRange: [9, 12], descriptor: "Nomme un changement de pratique et ce qui l'a déclenché. Mentionne au moins une difficulté rencontrée pendant la période." },
        { band: 2, scoreRange: [5, 8], descriptor: "Décrit ce qu'il a appris en termes de contenu du parcours, sans retour sur sa propre pratique. Aucune difficulté rapportée." },
        { band: 1, scoreRange: [0, 4], descriptor: "Bilan de satisfaction, appréciation du parcours ou remerciements. Aucun élément d'analyse personnelle." },
      ],
    },
    {
      label: "S3 — Ancrage culturel et organisationnel", competencyCode: "", weightPoints: 10, origin: "socle",
      whereToLook: "L'ensemble du dossier",
      bands: [
        { band: 4, scoreRange: [9, 10], descriptor: "La solution tient compte d'une contrainte nommée de son organisation ou de son contexte : obligation de disponibilité, distance hiérarchique, culture de l'oralité, coupure d'électricité, transport, horaires imposés, connectivité. Le candidat explique le compromis qu'il a trouvé pour agir sans rompre le code concerné." },
        { band: 3, scoreRange: [6, 8], descriptor: "Une contrainte de contexte est nommée, et au moins un élément de la solution y renvoie explicitement. Le compromis lui-même n'est pas formulé." },
        { band: 2, scoreRange: [3, 5], descriptor: "Le contexte est mentionné en décor (ville, secteur, poste) sans influence visible sur la solution retenue." },
        { band: 1, scoreRange: [0, 2], descriptor: "Solution transposable telle quelle depuis un manuel générique. Aucun élément de contexte n'intervient dans le raisonnement." },
      ],
    },
  ],
  totalPoints: 100,
  threshold: 70,
};
