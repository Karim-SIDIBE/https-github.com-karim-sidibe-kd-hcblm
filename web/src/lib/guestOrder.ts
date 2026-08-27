/**
 * guestOrder.ts — mémoire locale du jeton de suivi d'une commande invitée
 * (PAY-2bis). Le jeton scellé renvoyé au checkout est conservé sur l'appareil
 * pour que la page de retour (#/order/:id) puisse suivre la commande sans
 * session ; il n'ouvre que la lecture de CETTE commande, jamais le compte.
 */
const key = (orderId: string) => `klms_gorder_${orderId}`;

export function rememberOrderToken(orderId: string, token: string) {
  try { localStorage.setItem(key(orderId), token); } catch { /* stockage indisponible */ }
}

export function orderTokenOf(orderId: string): string | null {
  try { return localStorage.getItem(key(orderId)); } catch { return null; }
}
