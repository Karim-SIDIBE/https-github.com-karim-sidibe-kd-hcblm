/**
 * Demonstration data — shape mirrors the real analytics/enrollment API
 * (overview KPIs, completion funnel, learner rows). Swapped for live API calls
 * when the admin console is wired to the backend.
 */
export const COHORTS = ["Toutes cohortes", "Orange CI — Mars 2026", "MTN CI — Avril 2026", "Inter-entreprises — Mars 2026"];

export const BLOCKS = [
  { index: 0, type: "Onboarding", label: "Bloc 0 · Ancrage & déclencheur" },
  { index: 1, type: "Compréhension", label: "Bloc 1 · Compréhension" },
  { index: 2, type: "Pratique", label: "Bloc 2 · Pratique terrain" },
  { index: 3, type: "Ancrage", label: "Bloc 3 · Ancrage" },
  { index: 4, type: "Certification", label: "Bloc 4 · Projet & certification" },
];

export const KPIS = {
  enrolled: 300,
  enrolledTrend: +12,
  active7d: 214,
  active7dTrend: +6,
  completionRate: 41,
  completionTrend: +4,
  forecast: 68,
  projectsPending: 23,
};

/** Learners that have reached at least block N (cumulative funnel). */
export const FUNNEL = [
  { index: 0, label: "Bloc 0 · Ancrage", reached: 300 },
  { index: 1, label: "Bloc 1 · Compréhension", reached: 268 },
  { index: 2, label: "Bloc 2 · Pratique", reached: 201 },
  { index: 3, label: "Bloc 3 · Ancrage", reached: 152 },
  { index: 4, label: "Bloc 4 · Certifiés", reached: 123 },
];

export type Risk = "ok" | "watch" | "risk";
export type B4 = "—" | "soumis" | "en évaluation" | "validé" | "révision";
export type Learner = {
  id: string; name: string; email: string; cohort: string;
  progress: number; block: number; lastBadge: string; b4: B4;
  lastActive: string; relance: string; risk: Risk;
};

const AV = ["#F36F21", "#112E66", "#2DAA4F", "#2563EB", "#DB5E15", "#1A3B7A"];
export const avatarColor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
export const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const LEARNERS: Learner[] = [
  { id: "1", name: "Aminata Diallo", email: "aminata.d@orange.ci", cohort: "Orange CI — Mars 2026", progress: 100, block: 4, lastBadge: "Ancrage", b4: "validé", lastActive: "Aujourd'hui", relance: "—", risk: "ok" },
  { id: "2", name: "Kouamé N'Guessan", email: "kouame.n@orange.ci", cohort: "Orange CI — Mars 2026", progress: 82, block: 3, lastBadge: "Pratique", b4: "en évaluation", lastActive: "Hier", relance: "—", risk: "ok" },
  { id: "3", name: "Fatou Bensouda", email: "fatou.b@orange.ci", cohort: "Orange CI — Mars 2026", progress: 64, block: 2, lastBadge: "Compréhension", b4: "—", lastActive: "Il y a 2 j", relance: "J+3 envoyée", risk: "watch" },
  { id: "4", name: "Yao Brou", email: "yao.brou@orange.ci", cohort: "Orange CI — Mars 2026", progress: 22, block: 1, lastBadge: "Entré", b4: "—", lastActive: "Il y a 9 j", relance: "J+7 · SMS", risk: "risk" },
  { id: "5", name: "Mariam Koné", email: "mariam.k@mtn.ci", cohort: "MTN CI — Avril 2026", progress: 48, block: 2, lastBadge: "Compréhension", b4: "—", lastActive: "Aujourd'hui", relance: "—", risk: "ok" },
  { id: "6", name: "Ibrahim Cissé", email: "ibrahim.c@orange.ci", cohort: "Orange CI — Mars 2026", progress: 100, block: 4, lastBadge: "Ancrage", b4: "validé", lastActive: "Il y a 3 j", relance: "—", risk: "ok" },
  { id: "7", name: "Awa Traoré", email: "awa.traore@mtn.ci", cohort: "MTN CI — Avril 2026", progress: 12, block: 0, lastBadge: "—", b4: "—", lastActive: "Il y a 14 j", relance: "J+14 · escalade", risk: "risk" },
  { id: "8", name: "Serge Kouadio", email: "serge.k@orange.ci", cohort: "Orange CI — Mars 2026", progress: 76, block: 3, lastBadge: "Pratique", b4: "soumis", lastActive: "Hier", relance: "—", risk: "ok" },
  { id: "9", name: "Nadia Ouattara", email: "nadia.o@inter.ci", cohort: "Inter-entreprises — Mars 2026", progress: 58, block: 2, lastBadge: "Compréhension", b4: "—", lastActive: "Il y a 4 j", relance: "J+3 envoyée", risk: "watch" },
  { id: "10", name: "Patrick Aka", email: "patrick.aka@orange.ci", cohort: "Orange CI — Mars 2026", progress: 90, block: 4, lastBadge: "Ancrage", b4: "révision", lastActive: "Aujourd'hui", relance: "—", risk: "ok" },
  { id: "11", name: "Hawa Sangaré", email: "hawa.s@mtn.ci", cohort: "MTN CI — Avril 2026", progress: 34, block: 1, lastBadge: "Entré", b4: "—", lastActive: "Il y a 6 j", relance: "J+3 envoyée", risk: "watch" },
  { id: "12", name: "Olivier Béhi", email: "olivier.behi@inter.ci", cohort: "Inter-entreprises — Mars 2026", progress: 100, block: 4, lastBadge: "Ancrage", b4: "validé", lastActive: "Il y a 5 j", relance: "—", risk: "ok" },
  { id: "13", name: "Salimata Bamba", email: "salimata.b@orange.ci", cohort: "Orange CI — Mars 2026", progress: 8, block: 0, lastBadge: "—", b4: "—", lastActive: "Il y a 18 j", relance: "J+14 · escalade", risk: "risk" },
  { id: "14", name: "Désiré Yapo", email: "desire.yapo@mtn.ci", cohort: "MTN CI — Avril 2026", progress: 70, block: 3, lastBadge: "Pratique", b4: "—", lastActive: "Hier", relance: "—", risk: "ok" },
];

export const RECENT = [
  { who: "Aminata Diallo", what: "a obtenu le badge Ancrage", when: "il y a 12 min", kind: "badge" as const },
  { who: "Kouamé N'Guessan", what: "a soumis son projet Bloc 4", when: "il y a 40 min", kind: "b4" as const },
  { who: "Mariam Koné", what: "a terminé le quiz diagnostique", when: "il y a 1 h", kind: "quiz" as const },
  { who: "Patrick Aka", what: "a reçu une demande de révision", when: "il y a 2 h", kind: "rev" as const },
  { who: "Ibrahim Cissé", what: "a été certifié Niveau 1", when: "il y a 3 h", kind: "cert" as const },
];
