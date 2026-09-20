import {
  loadDayDockWorkspace,
  parseDayDockState,
  saveDayDockWorkspace,
  type StorageLike,
} from "../storage/dayDockPersistence";
import {
  createDayDockStore,
  type DayDockStore,
  type PersistenceStatus,
} from "./dayDockStore";

export const DAYDOCK_SYNC_CHANNEL = "daydock:workspace";

export interface BroadcastMessageEventLike {
  data: unknown;
}

export interface BroadcastChannelLike {
  postMessage: (message: unknown) => void;
  onmessage: ((event: BroadcastMessageEventLike) => void) | null;
  close?: () => void;
}

interface Revision {
  timestampMs: number;
  sourceId: string;
}

interface WorkspaceSyncMessage {
  kind: "daydock/workspace";
  sourceId: string;
  revision: Revision;
  state: unknown;
}

export interface SynchronizedDayDockStoreOptions {
  storage: StorageLike;
  channel: BroadcastChannelLike;
  sourceId?: string;
  nowMs?: () => number;
  now?: () => string;
}

export interface SynchronizedDayDockStore {
  store: DayDockStore;
  dispose: () => void;
}

function defaultSourceId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function defaultNowMs(): number {
  return Date.now();
}

function defaultNow(): string {
  return new Date().toISOString();
}

function compareRevision(left: Revision, right: Revision): number {
  if (left.timestampMs !== right.timestampMs) {
    return left.timestampMs - right.timestampMs;
  }

  return left.sourceId.localeCompare(right.sourceId);
}

function isWorkspaceSyncMessage(value: unknown): value is WorkspaceSyncMessage {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<WorkspaceSyncMessage>;
  const revision = candidate.revision as Partial<Revision> | undefined;

  return (
    candidate.kind === "daydock/workspace" &&
    typeof candidate.sourceId === "string" &&
    candidate.sourceId.length > 0 &&
    typeof revision === "object" &&
    revision !== null &&
    typeof revision.timestampMs === "number" &&
    Number.isFinite(revision.timestampMs) &&
    typeof revision.sourceId === "string" &&
    revision.sourceId.length > 0 &&
    revision.sourceId === candidate.sourceId &&
    "state" in candidate
  );
}

function nextRevision(
  lastRevision: Revision,
  sourceId: string,
  nowMs: () => number,
): Revision {
  return {
    timestampMs: Math.max(nowMs(), lastRevision.timestampMs + 1),
    sourceId,
  };
}

export function createSynchronizedDayDockStore({
  storage,
  channel,
  sourceId = defaultSourceId(),
  nowMs = defaultNowMs,
  now = defaultNow,
}: SynchronizedDayDockStoreOptions): SynchronizedDayDockStore {
  const loaded = loadDayDockWorkspace(storage, now);
  let persistenceStatus: PersistenceStatus = "durable";
  const store = createDayDockStore(loaded.state, {
    getPersistenceStatus: () => persistenceStatus,
  });

  let applyingRemoteSnapshot = false;
  let disposed = false;
  let lastRevision: Revision = {
    timestampMs: 0,
    sourceId: "",
  };

  const unsubscribe = store.subscribe(() => {
    if (disposed) return;

    const snapshot = store.getSnapshot();
    persistenceStatus = saveDayDockWorkspace(snapshot, storage, now)
      ? "durable"
      : "degraded";

    if (applyingRemoteSnapshot) return;

    const revision = nextRevision(lastRevision, sourceId, nowMs);
    lastRevision = revision;

    try {
      channel.postMessage({
        kind: "daydock/workspace",
        sourceId,
        revision,
        state: snapshot,
      } satisfies WorkspaceSyncMessage);
    } catch {
      // Live cross-tab transport is best-effort. Durable localStorage
      // persistence has already succeeded or failed independently.
    }
  });

  channel.onmessage = (event) => {
    if (disposed || !isWorkspaceSyncMessage(event.data)) return;

    const message = event.data;
    if (message.sourceId === sourceId) return;
    if (compareRevision(message.revision, lastRevision) <= 0) return;

    const nextState = parseDayDockState(message.state);
    if (nextState === null) return;

    lastRevision = message.revision;
    applyingRemoteSnapshot = true;

    try {
      store.replaceState(nextState);
    } finally {
      applyingRemoteSnapshot = false;
    }
  };

  return {
    store,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      channel.onmessage = null;
      channel.close?.();
    },
  };
}
