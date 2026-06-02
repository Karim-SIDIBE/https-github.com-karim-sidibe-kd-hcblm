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
  // granular interaction verbs (xAPI 1.0.3 + cmi5 / Video Profile)
  answered: { id: "http://adlnet.gov/expapi/verbs/answered", display: "answered" },
  progressed: { id: "http://adlnet.gov/expapi/verbs/progressed", display: "progressed" },
  experienced: { id: "http://adlnet.gov/expapi/verbs/experienced", display: "experienced" },
} as const;

export type VerbKey = keyof typeof VERBS;

export type Actor = { name: string; userId: string };

/** Extension IRIs used across granular statements (§5.2 / §8.1). */
export const XAPI_EXT = {
  enrollment: `${ACTIVITY_BASE}/extensions/enrollment`,
  block: `${ACTIVITY_BASE}/extensions/block`,
  session: `${ACTIVITY_BASE}/extensions/session`,
  exercise: `${ACTIVITY_BASE}/extensions/exercise`,
  feedbackViewed: `${ACTIVITY_BASE}/extensions/feedback-viewed`,
  correctResponse: `${ACTIVITY_BASE}/extensions/correct-response`,
  timeOnTaskSeconds: `${ACTIVITY_BASE}/extensions/time-on-task-seconds`,
  // ADL Video Profile (https://w3id.org/xapi/video)
  videoProgress: "https://w3id.org/xapi/video/extensions/progress",
  videoTime: "https://w3id.org/xapi/video/extensions/time",
  videoLength: "https://w3id.org/xapi/video/extensions/length",
} as const;

type Result = {
  score?: { scaled: number; raw: number; max: number };
  success?: boolean;
  completion?: boolean;
  /** Learner's response value (selected option / exercise answer). */
  response?: string;
  /** ISO 8601 duration, e.g. time-on-question / time-on-exercise. */
  duration?: string;
  extensions?: Record<string, unknown>;
};

export type XapiStatement = {
  actor: Record<string, unknown>;
  verb: { id: string; display: { "en-US": string } };
  object: { id: string; objectType: "Activity"; definition: { name: { "fr-FR": string } } };
  result?: Result;
  context: { extensions: Record<string, unknown> };
  timestamp: string;
};

/** Seconds → ISO 8601 duration (whole seconds), e.g. 95 → "PT95S". */
export function secondsToIsoDuration(seconds: number): string {
  return `PT${Math.max(0, Math.round(seconds))}S`;
}

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
  /** Extra context extensions (block/session/exercise ids, video metadata…). */
  contextExtensions?: Record<string, unknown>;
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
    context: { extensions: { [XAPI_EXT.enrollment]: params.enrollmentId, ...(params.contextExtensions ?? {}) } },
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
