/**
 * profile.ts — divergence entre le profil auto-déclaré (Bloc 0, archétypes A–D)
 * et le résultat du quiz diagnostique (Bloc 1, bandes de score).
 *
 * K-HCBLM v2.2, Pilier 2 : « Le diagnostic situationnel fait autorité. Lorsque
 * son résultat s'écarte du profil auto-déclaré, l'interface l'énonce
 * explicitement au lieu de laisser les deux coexister. »
 *
 * Les deux taxonomies étant distinctes, la correspondance est déclarée par la
 * conceptrice sur chaque archétype (`consistentBands` : les bandes cohérentes
 * avec ce profil). Sans correspondance déclarée, la divergence est inconnue
 * (`null`) — l'interface énonce alors la juxtaposition et l'autorité du
 * diagnostic, sans affirmer d'écart.
 *
 * Module sans zod (importable par la PWA comme par le serveur).
 */

export type SelfProfileChoice = { key: string; name: string; consistentBands?: string[] };

export type ProfileDivergence = {
  /** Nom de l'archétype auto-déclaré. */
  selfName: string;
  /** Nom de la bande issue du diagnostic. */
  bandName: string;
  /** true = s'écarte · false = cohérent · null = correspondance non déclarée. */
  diverges: boolean | null;
};

/** Compare le profil auto-déclaré à la bande du diagnostic. Retourne null si
 *  l'un des deux manque (rien à énoncer). */
export function profileDivergence(
  self: SelfProfileChoice | null | undefined,
  bandName: string | null | undefined,
): ProfileDivergence | null {
  if (!self?.name || !bandName) return null;
  const bands = (self.consistentBands ?? []).map((b) => b.trim().toLowerCase()).filter(Boolean);
  const diverges = bands.length === 0 ? null : !bands.includes(bandName.trim().toLowerCase());
  return { selfName: self.name, bandName, diverges };
}
