/**
 * reengagement.ts — proactive re-engagement of inactive learners (Pilier 6.4).
 *
 * Tonality is encouraging, never guilt-inducing (spec requirement).
 *   - J+3 : "where you were + what's left in this block".
 *   - J+7 : anchored in the Moment d'Ancrage — THIS is the engine-level reuse of
 *           the PAM that the content validator used to flag as `pam.day7`. It now
 *           lives here, where it belongs, and is covered by tests.
 *   - J+14: admin signal for enterprise enrolments; a soft nudge otherwise.
 */
import type { ResumeTarget } from "./resume.js";

export type Stage = "J3" | "J7" | "J14";
export type Channel = "LEARNER" | "ADMIN";

export const STAGE_THRESHOLD_DAYS: Record<Stage, number> = { J3: 3, J7: 7, J14: 14 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysInactive(lastActivity: Date, now: Date): number {
  return Math.floor((now.getTime() - lastActivity.getTime()) / MS_PER_DAY);
}

/** Highest stage whose threshold the inactivity has crossed (J14 > J7 > J3). */
export function dueStage(days: number): Stage | null {
  if (days >= STAGE_THRESHOLD_DAYS.J14) return "J14";
  if (days >= STAGE_THRESHOLD_DAYS.J7) return "J7";
  if (days >= STAGE_THRESHOLD_DAYS.J3) return "J3";
  return null;
}

export type MessageInput = {
  learnerName: string;
  momentAncrage: string | null | undefined;
  isEnterprise: boolean;
  resume: ResumeTarget | null;
  blockDurationEstimate: string;
};

export function buildMessage(stage: Stage, input: MessageInput): { channel: Channel; body: string } {
  const where = input.resume ? `« ${input.resume.itemLabel} » (${input.resume.blockTitle})` : "le début de votre parcours";
  const left = input.blockDurationEstimate ? ` Il vous reste ${input.blockDurationEstimate} pour compléter ce bloc.` : "";

  switch (stage) {
    case "J3":
      return { channel: "LEARNER", body: `Votre parcours vous attend. Vous en étiez à ${where}.${left}` };
    case "J7": {
      const pam = (input.momentAncrage ?? "").trim();
      const anchor = pam.length > 0 ? `La situation que vous avez décrite — « ${pam} » — ` : "La situation que vous avez décrite au Bloc 0 ";
      return { channel: "LEARNER", body: `${anchor}mérite les outils de ce parcours. Reprenez quand vous avez 15 minutes.` };
    }
    case "J14":
      return input.isEnterprise
        ? { channel: "ADMIN", body: `${input.learnerName} est inactif depuis 14 jours. Une relance humaine pourrait être pertinente.` }
        : { channel: "LEARNER", body: `Cela fait deux semaines. Pas de pression — 15 minutes suffisent pour reprendre là où vous en étiez : ${where}.` };
  }
}

/** True if the J+7 message actually re-injects the PAM (engine invariant). */
export function day7AnchorsPam(momentAncrage: string): boolean {
  return buildMessage("J7", {
    learnerName: "x", momentAncrage, isEnterprise: false, resume: null, blockDurationEstimate: "",
  }).body.includes(momentAncrage);
}
