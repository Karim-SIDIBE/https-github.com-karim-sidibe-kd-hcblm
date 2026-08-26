/**
 * money.ts — primitives monétaires du domaine paiement (pur, sans I/O).
 *
 * Règle d'or (spec architecture paiement §01) : les montants sont stockés et
 * manipulés en ENTIERS d'unité mineure (`amountMinor`), jamais en flottants —
 * 1 = 1 F CFA pour XOF/XAF (pas de subdivision en usage), 1 = 1 centime pour
 * l'EUR. Les prix sont rédigés par devise (aucune conversion automatique).
 */

export const CURRENCIES = ["XOF", "XAF", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Nombre de décimales de l'unité mineure par devise. */
export const MINOR_DIGITS: Record<Currency, number> = { XOF: 0, XAF: 0, EUR: 2 };

/** Libellés d'affichage des zones monétaires (menu de devises). */
export const CURRENCY_LABELS: Record<Currency, string> = {
  XOF: "XOF (Afrique de l'Ouest)",
  XAF: "XAF (Afrique Centrale)",
  EUR: "EUR",
};

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** Un montant est valide s'il est un entier strictement positif et borné
 *  (garde-fou contre les débordements et les valeurs absurdes). */
export const MAX_AMOUNT_MINOR = 1_000_000_000; // 1 milliard d'unités mineures
export function isValidAmountMinor(amountMinor: number): boolean {
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 && amountMinor <= MAX_AMOUNT_MINOR;
}

/** Formate un montant mineur pour l'affichage : « 15 000 F CFA », « 25,00 € ». */
export function formatAmount(amountMinor: number, currency: Currency): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error(`Montant non entier : ${amountMinor}`);
  const digits = MINOR_DIGITS[currency];
  const major = digits === 0 ? amountMinor : Math.trunc(amountMinor / 10 ** digits);
  const frac = digits === 0 ? "" : String(Math.abs(amountMinor) % 10 ** digits).padStart(digits, "0");
  // Regroupement par milliers à l'espace insécable fine (usage francophone).
  const grouped = Math.abs(major).toLocaleString("fr-FR").replace(/ /g, " ");
  const sign = amountMinor < 0 ? "-" : "";
  switch (currency) {
    case "XOF":
    case "XAF":
      return `${sign}${grouped} F CFA`;
    case "EUR":
      return `${sign}${grouped},${frac} €`;
  }
}

/** Unité mineure → unité majeure (nombre), pour les API fournisseur qui
 *  attendent le montant en unités principales (ex. CinetPay). */
export function toAmountMajor(amountMinor: number, currency: Currency): number {
  const digits = MINOR_DIGITS[currency];
  return digits === 0 ? amountMinor : Number((amountMinor / 10 ** digits).toFixed(digits));
}

/** Parse un montant saisi en unités majeures (« 15000 », « 25.50 ») vers
 *  l'unité mineure de la devise. Refuse toute perte de précision. */
export function toAmountMinor(majorInput: string | number, currency: Currency): number {
  const digits = MINOR_DIGITS[currency];
  const s = String(majorInput).trim().replace(",", ".").replace(/\s/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Montant invalide : « ${majorInput} »`);
  const [int, frac = ""] = s.split(".");
  if (frac.length > digits) throw new Error(`Trop de décimales pour ${currency} (max ${digits}) : « ${majorInput} »`);
  const minor = Number(int) * 10 ** digits + Number(frac.padEnd(digits, "0") || 0);
  if (!isValidAmountMinor(minor)) throw new Error(`Montant hors bornes : « ${majorInput} »`);
  return minor;
}
