/**
 * composition.service.ts — période d'observation du dispositif d'authenticité
 * (avenant n°1 au socle, objet F.9 / annexe §8, étape 2).
 *
 * Pendant l'observation, AUCUN signal n'est calculé, AUCUNE restitution
 * par dossier n'existe et rien ne remonte au Directeur Pédagogique dossier par
 * dossier : seule la DISTRIBUTION des quatre indicateurs est mesurée sur la
 * population, ventilée mobile / ordinateur, pour placer ensuite les seuils aux
 * ruptures observées (jamais à des valeurs choisies a priori).
 *
 * Critère de sortie (annexe §8) : au moins 200 dossiers soumis, dont au moins
 * un tiers produits sur mobile — en deçà, l'observation se prolonge.
 */
import { prisma } from "../../db/prisma.js";

const QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9] as const;

function quantiles(sorted: number[]): Record<string, number> | null {
  if (!sorted.length) return null;
  const out: Record<string, number> = {};
  for (const q of QUANTILES) {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    out[`p${Math.round(q * 100)}`] = Number(sorted[idx]!.toFixed(3));
  }
  return out;
}

function summarize(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  return { n: nums.length, quantiles: quantiles(nums) };
}

/** Distribution des quatre indicateurs, ventilée par appareil et par nature de
 *  champ (ancrage / journal / section) — agrégats anonymes, aucun dossier
 *  individuel. */
export async function observationDistribution() {
  const rows = await prisma.compositionMetric.findMany({
    select: {
      fieldKey: true, device: true,
      depositRate: true, retouchRate: true, density: true, spread: true,
      enrollmentId: true,
    },
  });
  const kindOf = (fieldKey: string) =>
    fieldKey === "bloc0.ancrage" ? "ancrage" : fieldKey.startsWith("bloc4.journal.") ? "journal" : "section";

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.device}:${kindOf(r.fieldKey)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const distribution = [...groups.entries()].map(([key, g]) => {
    const [device, kind] = key.split(":");
    return {
      device, kind, fields: g.length,
      depositRate: summarize(g.map((r) => r.depositRate)),
      retouchRate: summarize(g.map((r) => r.retouchRate)),
      density: summarize(g.map((r) => r.density)),
      ...(kind === "journal" ? { spread: summarize(g.map((r) => r.spread)) } : {}),
    };
  }).sort((a, b) => `${a.device}:${a.kind}`.localeCompare(`${b.device}:${b.kind}`));

  // Critère de sortie de l'observation : ≥ 200 dossiers, ≥ 1/3 sur mobile.
  const byEnrollment = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byEnrollment.has(r.enrollmentId)) byEnrollment.set(r.enrollmentId, new Set());
    byEnrollment.get(r.enrollmentId)!.add(r.device);
  }
  const dossiers = byEnrollment.size;
  const mobileDossiers = [...byEnrollment.values()].filter((d) => d.has("mobile")).length;
  const exemptLearners = await prisma.user.count({ where: { compositionExempt: true } });

  return {
    mode: "observation" as const, // F.9 : aucun seuil, aucun signal, aucune restitution par dossier
    dossiers,
    mobileDossiers,
    mobileShare: dossiers ? Number((mobileDossiers / dossiers).toFixed(3)) : 0,
    exitCriteriaMet: dossiers >= 200 && mobileDossiers * 3 >= dossiers,
    exemptLearners,
    distribution,
  };
}
