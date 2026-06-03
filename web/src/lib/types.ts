export type QueuedAction = {
  opId: string;
  type: string;
  clientTs: string;
  payload?: Record<string, unknown>;
};

export type SyncResult = { opId: string; status: "applied" | "deduped" | "failed"; error?: string };
