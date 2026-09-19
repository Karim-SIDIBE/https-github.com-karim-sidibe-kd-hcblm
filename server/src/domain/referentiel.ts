/**
 * referentiel.ts — Référentiel officiel des compétences KOMPETENCES SOFT SKILLS
 * v3.0 (applicable au 01/11/2026). 13 domaines, 52 compétences clés.
 *
 * Source normative : « Référentiel officiel des compétences · v3.0 » (document
 * DRH). La plateforme n'en encode que la CARTOGRAPHIE (codes et libellés) —
 * les indicateurs comportementaux par niveau restent dans le document et dans
 * les annexes de parcours. Les compétences certifiées sont celles du
 * référentiel « dans sa version applicable à la date de production du
 * parcours » (K-HCBLM v2.3, A3.1).
 */

export type ReferentielDomain = {
  code: string;
  label: string;
  competencies: { code: string; label: string }[];
};

export const REFERENTIEL_VERSION = "3.0";

export const REFERENTIEL_V3: ReferentielDomain[] = [
  {
    code: "D1", label: "Communication professionnelle",
    competencies: [
      { code: "D1.C1", label: "Clarté et structuration du message" },
      { code: "D1.C2", label: "Écoute active et reformulation" },
      { code: "D1.C3", label: "Prise de parole et impact" },
      { code: "D1.C4", label: "Communication écrite professionnelle" },
    ],
  },
  {
    code: "D2", label: "Collaboration et travail d'équipe",
    competencies: [
      { code: "D2.C1", label: "Coopération et entraide" },
      { code: "D2.C2", label: "Partage de l'information" },
      { code: "D2.C3", label: "Contribution à un objectif collectif" },
      { code: "D2.C4", label: "Gestion des interfaces et des parties prenantes" },
    ],
  },
  {
    code: "D3", label: "Management et leadership",
    competencies: [
      { code: "D3.C1", label: "Vision et cap" },
      { code: "D3.C2", label: "Animation et mobilisation d'équipe" },
      { code: "D3.C3", label: "Pilotage de la performance" },
      { code: "D3.C4", label: "Développement des collaborateurs" },
      { code: "D3.C5", label: "Posture de leader" },
    ],
  },
  {
    code: "D4", label: "Productivité et organisation",
    competencies: [
      { code: "D4.C1", label: "Organisation personnelle" },
      { code: "D4.C2", label: "Gestion des priorités" },
      { code: "D4.C3", label: "Gestion du temps et des interruptions" },
      { code: "D4.C4", label: "Performance durable et charge mentale" },
    ],
  },
  {
    code: "D5", label: "Résolution de problèmes et décision",
    competencies: [
      { code: "D5.C1", label: "Analyse et diagnostic" },
      { code: "D5.C2", label: "Génération et évaluation d'options" },
      { code: "D5.C3", label: "Prise de décision" },
      { code: "D5.C4", label: "Mise en œuvre et suivi" },
    ],
  },
  {
    code: "D6", label: "Esprit critique et créativité",
    competencies: [
      { code: "D6.C1", label: "Esprit critique et raisonnement" },
      { code: "D6.C2", label: "Créativité appliquée" },
      { code: "D6.C3", label: "Innovation et amélioration continue" },
    ],
  },
  {
    code: "D7", label: "Intelligence émotionnelle et relationnelle",
    competencies: [
      { code: "D7.C1", label: "Conscience de soi" },
      { code: "D7.C2", label: "Régulation émotionnelle et gestion du stress" },
      { code: "D7.C3", label: "Empathie et lecture des autres" },
      { code: "D7.C4", label: "Qualité de la relation professionnelle" },
    ],
  },
  {
    code: "D8", label: "Adaptabilité et gestion du changement",
    competencies: [
      { code: "D8.C1", label: "Adaptabilité individuelle" },
      { code: "D8.C2", label: "Apprentissage continu" },
      { code: "D8.C3", label: "Accompagnement du changement" },
      { code: "D8.C4", label: "Résilience professionnelle" },
    ],
  },
  {
    code: "D9", label: "Gestion des conflits et coopération difficile",
    competencies: [
      { code: "D9.C1", label: "Prévention des conflits" },
      { code: "D9.C2", label: "Désescalade et médiation" },
      { code: "D9.C3", label: "Négociation et recherche d'accord" },
      { code: "D9.C4", label: "Restauration de la relation" },
    ],
  },
  {
    code: "D10", label: "Éthique et responsabilité professionnelle",
    competencies: [
      { code: "D10.C1", label: "Intégrité et déontologie" },
      { code: "D10.C2", label: "Responsabilité et redevabilité" },
      { code: "D10.C3", label: "Conformité et lutte contre les dérives" },
      { code: "D10.C4", label: "Responsabilité sociétale" },
    ],
  },
  {
    code: "D11", label: "Entrepreneuriat et création d'entreprise",
    competencies: [
      { code: "D11.C1", label: "État d'esprit entrepreneurial et agile" },
      { code: "D11.C2", label: "Conception et développement de projet ou de startup" },
      { code: "D11.C3", label: "Modèle économique et viabilité" },
      { code: "D11.C4", label: "Levée de fonds et relation investisseurs" },
    ],
  },
  {
    code: "D12", label: "Maturité numérique et intelligence artificielle",
    competencies: [
      { code: "D12.C1", label: "Maturité numérique" },
      { code: "D12.C2", label: "Collaboration et productivité numériques" },
      { code: "D12.C3", label: "Usage pertinent de l'intelligence artificielle" },
      { code: "D12.C4", label: "Esprit critique et usage responsable de l'IA" },
    ],
  },
  {
    code: "D13", label: "Sécurité de l'information et vigilance professionnelle",
    competencies: [
      { code: "D13.C1", label: "Vigilance et détection des signaux anormaux" },
      { code: "D13.C2", label: "Résistance à la manipulation et à la pression" },
      { code: "D13.C3", label: "Protection des informations et des accès confiés" },
      { code: "D13.C4", label: "Alerte, signalement et réaction à l'incident" },
    ],
  },
];

export function referentielDomain(code: string): ReferentielDomain | undefined {
  return REFERENTIEL_V3.find((d) => d.code === code.toUpperCase());
}
