import { z } from "zod";
import {
  createInitialDayDockState,
  type ActiveFocusSession,
  type DayDockState,
  type FocusSessionRecord,
  type Person,
  type Task,
} from "../domain/daydock/model";
import {
  createDayDockStore,
  type DayDockStore,
} from "../store/dayDockStore";

export const DAYDOCK_STORAGE_KEY = "daydock:workspace";
export const DAYDOCK_SCHEMA_VERSION = 2 as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type WorkspaceLoadSource =
  | "empty"
  | "stored"
  | "migrated"
  | "recovered";

export interface WorkspaceLoadResult {
  state: DayDockState;
  source: WorkspaceLoadSource;
}

const isoDateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Expected a valid date-time string",
);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const taskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(280),
    status: z.enum(["inbox", "today", "later", "done"]),
    estimateMinutes: z.number().int().positive().max(24 * 60).nullable(),
    personId: z.string().min(1).nullable(),
    createdAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.nullable(),
  })
  .refine(
    (task) =>
      task.status === "done"
        ? task.completedAt !== null
        : task.completedAt === null,
    "Completion timestamp must match task status",
  );

const personSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  context: z.string().max(2_000),
  nextFollowUpDate: isoDateSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

const activeFocusSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: isoDateTimeSchema,
  durationMinutes: z.number().int().min(5).max(240),
  pausedAt: isoDateTimeSchema.nullable(),
  accumulatedPauseMs: z.number().int().nonnegative(),
});

const focusRecordSchema = activeFocusSchema.extend({
  pausedAt: z.null(),
  endedAt: isoDateTimeSchema,
  outcome: z.enum(["completed", "stopped"]),
});

const legacyStateSchema = z.object({
  tasks: z.record(z.string(), taskSchema),
  taskOrder: z.array(z.string()),
  top3: z.array(z.string()).max(3),
  people: z.record(z.string(), personSchema),
  personOrder: z.array(z.string()),
});

const dayDockStateSchema = legacyStateSchema.extend({
  focus: z.object({
    active: activeFocusSchema.nullable(),
    history: z.array(focusRecordSchema),
  }),
});

const v2EnvelopeSchema = z.object({
  schemaVersion: z.literal(DAYDOCK_SCHEMA_VERSION),
  updatedAt: isoDateTimeSchema,
  data: dayDockStateSchema,
});

const v1EnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: isoDateTimeSchema,
  data: legacyStateSchema,
});

const v0EnvelopeSchema = z.object({
  schemaVersion: z.literal(0),
  data: legacyStateSchema,
});

function uniqueExistingOrder<T>(
  requestedOrder: readonly string[],
  records: Record<string, T>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const id of requestedOrder) {
    if (!records[id] || seen.has(id)) continue;
    result.push(id);
    seen.add(id);
  }

  for (const id of Object.keys(records)) {
    if (seen.has(id)) continue;
    result.push(id);
  }

  return result;
}

function normalizeFocusSession(
  session: ActiveFocusSession,
  tasks: Record<string, Task>,
): ActiveFocusSession | null {
  const task = tasks[session.taskId];
  if (!task || task.status !== "today") return null;

  return session;
}

function normalizeFocusHistory(
  history: FocusSessionRecord[],
  tasks: Record<string, Task>,
): FocusSessionRecord[] {
  return history.filter((session) => Boolean(tasks[session.taskId]));
}

export function normalizeDayDockState(state: DayDockState): DayDockState {
  const people: Record<string, Person> = {};

  for (const [id, person] of Object.entries(state.people)) {
    people[id] = {
      ...person,
      id,
      name: person.name.trim(),
      context: person.context.trim(),
    };
  }

  const tasks: Record<string, Task> = {};

  for (const [id, task] of Object.entries(state.tasks)) {
    tasks[id] = {
      ...task,
      id,
      title: task.title.trim(),
      personId:
        task.personId !== null && people[task.personId]
          ? task.personId
          : null,
    };
  }

  const taskOrder = uniqueExistingOrder(state.taskOrder, tasks);
  const personOrder = uniqueExistingOrder(state.personOrder, people);

  const top3: string[] = [];
  const seenTop3 = new Set<string>();

  for (const id of state.top3) {
    const task = tasks[id];
    if (!task || task.status !== "today" || seenTop3.has(id)) continue;

    top3.push(id);
    seenTop3.add(id);

    if (top3.length === 3) break;
  }

  return {
    tasks,
    taskOrder,
    top3,
    people,
    personOrder,
    focus: {
      active:
        state.focus.active === null
          ? null
          : normalizeFocusSession(state.focus.active, tasks),
      history: normalizeFocusHistory(state.focus.history, tasks),
    },
  };
}

function withEmptyFocus(
  state: z.infer<typeof legacyStateSchema>,
): DayDockState {
  return {
    ...state,
    focus: {
      active: null,
      history: [],
    },
  };
}

function defaultNow(): string {
  return new Date().toISOString();
}

export function saveDayDockWorkspace(
  state: DayDockState,
  storage: StorageLike,
  now: () => string = defaultNow,
): boolean {
  const envelope = {
    schemaVersion: DAYDOCK_SCHEMA_VERSION,
    updatedAt: now(),
    data: normalizeDayDockState(state),
  };

  try {
    storage.setItem(DAYDOCK_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadDayDockWorkspace(
  storage: StorageLike,
  now: () => string = defaultNow,
): WorkspaceLoadResult {
  let raw: string | null;

  try {
    raw = storage.getItem(DAYDOCK_STORAGE_KEY);
  } catch {
    return {
      state: createInitialDayDockState(),
      source: "recovered",
    };
  }

  if (raw === null) {
    return {
      state: createInitialDayDockState(),
      source: "empty",
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      state: createInitialDayDockState(),
      source: "recovered",
    };
  }

  const current = v2EnvelopeSchema.safeParse(parsed);

  if (current.success) {
    return {
      state: normalizeDayDockState(current.data.data),
      source: "stored",
    };
  }

  const v1 = v1EnvelopeSchema.safeParse(parsed);

  if (v1.success) {
    const state = normalizeDayDockState(withEmptyFocus(v1.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  const v0 = v0EnvelopeSchema.safeParse(parsed);

  if (v0.success) {
    const state = normalizeDayDockState(withEmptyFocus(v0.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  return {
    state: createInitialDayDockState(),
    source: "recovered",
  };
}

export interface PersistentStoreOptions {
  storage: StorageLike;
  now?: () => string;
}

export function createPersistentDayDockStore({
  storage,
  now = defaultNow,
}: PersistentStoreOptions): DayDockStore {
  const loaded = loadDayDockWorkspace(storage, now);
  const store = createDayDockStore(loaded.state);

  store.subscribe(() => {
    saveDayDockWorkspace(store.getSnapshot(), storage, now);
  });

  return store;
}
