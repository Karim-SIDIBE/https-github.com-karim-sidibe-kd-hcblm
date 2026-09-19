/**
 * composition.ts — capture des signaux de composition des champs certifiants
 * (avenant n°1 au socle, objet F + annexe technique).
 *
 * AGRÉGATS SEULEMENT : jamais la séquence des caractères, jamais le contenu,
 * jamais le presse-papiers. Les compteurs partent avec la SOUMISSION du champ
 * (une écriture unique) — rien n'est transmis pendant la saisie.
 *
 * Origines d'insertion (annexe §4) — la distinction vient du navigateur
 * (beforeinput.inputType), pas d'une heuristique :
 *   - frappe, saisie gestuelle/prédictive, dictée → COMPOSITION
 *   - collage explicite (insertFromPaste)         → DÉPÔT
 * Cas non résolu (annexe §4) : une origine inconnue est comptée comme
 * composition, jamais comme dépôt — le faux négatif est préférable au faux
 * positif.
 */

export type CompositionCapture = {
  device: "mobile" | "desktop";
  firstInputAt: string; // ISO
  charsTotal: number;
  charsComposed: number;
  charsPasted: number;
  deleteEvents: number;
  retouchesAfterPaste: number;
  sessions: number;
};

const SESSION_GAP_MS = 10 * 60_000; // sessions de saisie séparées de > 10 min

const isMobile = (): "mobile" | "desktop" => {
  try {
    const uaMobile = (navigator as any).userAgentData?.mobile;
    if (typeof uaMobile === "boolean") return uaMobile ? "mobile" : "desktop";
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
  } catch { return "desktop"; }
};

/** Compteur attaché à UN champ certifiant. Brancher `onBeforeInput` sur
 *  l'événement beforeInput du textarea, puis appeler `capture(texteFinal)` au
 *  moment de la soumission. */
export class FieldMeter {
  private firstInputAt: number | null = null;
  private lastEventAt: number | null = null;
  private sessions = 0;
  private composed = 0;
  private pasted = 0;
  private deletes = 0;
  private retouchesAfterPaste = 0;
  private hasPasted = false;

  /** Accepte l'événement natif OU le SyntheticEvent React (nativeEvent). */
  onBeforeInput = (evt: { inputType?: string; data?: string | null; dataTransfer?: DataTransfer | null; nativeEvent?: { inputType?: string; data?: string | null; dataTransfer?: DataTransfer | null } }) => {
    try {
      const e = evt.inputType != null ? evt : (evt.nativeEvent ?? evt);
      const now = Date.now();
      if (this.firstInputAt == null) this.firstInputAt = now;
      if (this.lastEventAt == null || now - this.lastEventAt > SESSION_GAP_MS) this.sessions += 1;
      this.lastEventAt = now;

      const type = e.inputType ?? "insertText";
      const len = (e.data ?? e.dataTransfer?.getData?.("text") ?? "").length;
      if (type === "insertFromPaste" || type === "insertFromDrop") {
        this.pasted += Math.max(1, len);
        this.hasPasted = true;
        // « postérieures au DERNIER collage » : le compteur repart à zéro.
        this.retouchesAfterPaste = 0;
      } else if (type.startsWith("delete") || type === "historyUndo") {
        this.deletes += 1;
        if (this.hasPasted) this.retouchesAfterPaste += 1;
      } else if (type.startsWith("insert") || type === "historyRedo") {
        // Frappe, composition (gestuelle/prédictive), dictée : COMPOSITION.
        this.composed += Math.max(1, len);
        // Une insertion qui remplace après un collage est aussi une retouche.
        if (this.hasPasted && (type === "insertReplacementText" || type === "insertCompositionText")) this.retouchesAfterPaste += 1;
      }
    } catch { /* la mesure n'interfère jamais avec la saisie */ }
  };

  /** True dès qu'une saisie a eu lieu (sinon, rien à transmettre). */
  get active(): boolean { return this.firstInputAt != null; }

  capture(finalText: string): CompositionCapture | undefined {
    if (this.firstInputAt == null) return undefined;
    return {
      device: isMobile(),
      firstInputAt: new Date(this.firstInputAt).toISOString(),
      charsTotal: finalText.length,
      charsComposed: this.composed,
      charsPasted: this.pasted,
      deleteEvents: this.deletes,
      retouchesAfterPaste: this.retouchesAfterPaste,
      sessions: Math.max(1, this.sessions),
    };
  }
}
