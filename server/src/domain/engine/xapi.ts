/**
 * xapi.ts — xAPI (Tin Can) statement builders (pure).
 *
 * Statements are stored locally (XapiStatement) and can be forwarded to an
 * external LRS. Verb/activity IRIs follow ADL + OpenBadges vocabularies so the
 * data is interoperable with standard LRS tooling.
 */
const LRS_HOME = "https://declick.kompetences.net";
const ACTIVITY_BASE = `${LRS_HOME}/xapi`;

export const VERBS = {
  initialized: { id: "http://adlnet.gov/expapi/verbs/initialized", display: "initialized" },
  completed: { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  passed: { id: "http://adlnet.gov/expapi/verbs/passed", display: "passed" },
  failed: { id: "http://adlnet.gov/expapi/verbs/failed", display: "failed" },
  earned: { id: "https://w3id.org/xapi/openbadges/verbs/earned", display: "earned" },
  registered: { id: "http://adlnet.gov/expapi/verbs/registered", display: "registered" },
  attended: { id: "http://adlnet.gov/expapi/verbs/attended", display: "attended" },
} as const;

export type VerbKey = keyof typeof VERBS;

export type Actor = { name: string; userId: string };

type Result = {
  score?: { scaled: number; raw: number; max: number };
  success?: boolean;
  completion?: boolean;
};

export type XapiStatement = {
  actor: Record<string, unknown>;
  verb: { id: string; display: { "en-US": string } };
  object: { id: string; objectType: "Activity"; definition: { name: { "fr-FR": string } } };
  result?: Result;
  context: { extensions: Record<string, unknown> };
  timestamp: string;
};

export function activityId(courseSlug: string, parts: string[] = []): string {
  return [`${ACTIVITY_BASE}/courses/${courseSlug}`, ...parts].join("/");
}

export function buildStatement(params: {
  actor: Actor;
  verb: VerbKey;
  objectId: string;
  objectName: string;
  result?: Result;
  enrollmentId: string;
  at?: Date;
}): XapiStatement {
  const v = VERBS[params.verb];
  return {
    actor: {
      objectType: "Agent",
      name: params.actor.name,
      account: { homePage: LRS_HOME, name: params.actor.userId },
    },
    verb: { id: v.id, display: { "en-US": v.display } },
    object: {
      id: params.objectId,
      objectType: "Activity",
      definition: { name: { "fr-FR": params.objectName } },
    },
    ...(params.result ? { result: params.result } : {}),
    context: { extensions: { [`${ACTIVITY_BASE}/extensions/enrollment`]: params.enrollmentId } },
    timestamp: (params.at ?? new Date()).toISOString(),
  };
}

/** Build a quiz result object from a percentage. */
export function quizResult(scorePct: number, correct: number, total: number, passThreshold?: number): Result {
  return {
    score: { scaled: Math.round((scorePct / 100) * 100) / 100, raw: correct, max: total },
    completion: true,
    ...(passThreshold != null ? { success: scorePct >= passThreshold } : {}),
  };
}
