import { z } from "zod";
import {
  createInitialDayDockState,
  type ActiveFocusSession,
  type CalendarState,
  type DayDockState,
  type DayPlan,
  type FocusSessionRecord,
  type Person,
  type Task,
} from "../domain/daydock/model";
import {
  createDayDockStore,
  type DayDockStore,
  type PersistenceStatus,
} from "../store/dayDockStore";

export const DAYDOCK_STORAGE_KEY = "daydock:workspace";
export const DAYDOCK_SCHEMA_VERSION = 7 as const;

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

const recurrenceSchema = z.object({
  kind: z.enum(["daily", "weekdays", "weekly", "monthly"]),
  anchorDate: isoDateSchema,
});

const taskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(280),
    status: z.enum(["inbox", "today", "later", "done"]),
    estimateMinutes: z.number().int().positive().max(24 * 60).nullable(),
    personId: z.string().min(1).nullable(),
    deferUntil: isoDateSchema.nullable().default(null),
    recurrence: recurrenceSchema.nullable().default(null),
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

const dayPlanSchema = z.object({
  dateKey: isoDateSchema,
  focusRoomMinutes: z.number().int().min(30).max(480),
  startedAt: isoDateTimeSchema,
});

const calendarEventSchema = z
  .object({
    id: z.string().min(1).max(240),
    title: z.string().trim().min(1).max(280),
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    allDay: z.boolean(),
    source: z.literal("ics"),
  })
  .refine(
    (event) => Date.parse(event.endAt) > Date.parse(event.startAt),
    "Calendar event end must be after start",
  );

const calendarStateSchema = z.object({
  events: z.array(calendarEventSchema).max(1_500),
  importedAt: isoDateTimeSchema.nullable(),
  sourceLabel: z.string().trim().min(1).max(180).nullable(),
});

const notificationPreferencesSchema = z.object({
  readyAgain: z.boolean(),
  lastReadyAgainNotifiedDate: isoDateSchema.nullable(),
});

const workdayPreferencesSchema = z
  .object({
    startHour: z.number().min(0).max(23.5),
    endHour: z.number().min(0.5).max(24),
  })
  .refine(
    (workday) =>
      Number.isInteger(workday.startHour * 2) &&
      Number.isInteger(workday.endHour * 2) &&
      workday.startHour < workday.endHour,
    "Workday must use 30-minute increments with end after start",
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

const v3StateSchema = legacyStateSchema.extend({
  focus: z.object({
    active: activeFocusSchema.nullable(),
    history: z.array(focusRecordSchema),
  }),
});

const v4StateSchema = v3StateSchema.extend({
  dayPlan: dayPlanSchema.nullable().default(null),
});

const v5StateSchema = v4StateSchema.extend({
  calendar: calendarStateSchema,
});

const v6StateSchema = v5StateSchema.extend({
  notifications: notificationPreferencesSchema,
});

const dayDockStateSchema = v6StateSchema.extend({
  workday: workdayPreferencesSchema,
});

const v7EnvelopeSchema = z.object({
  schemaVersion: z.literal(DAYDOCK_SCHEMA_VERSION),
  updatedAt: isoDateTimeSchema,
  data: dayDockStateSchema,
});

const v6EnvelopeSchema = z.object({
  schemaVersion: z.literal(6),
  updatedAt: isoDateTimeSchema,
  data: v6StateSchema,
});

const v5EnvelopeSchema = z.object({
  schemaVersion: z.literal(5),
  updatedAt: isoDateTimeSchema,
  data: v5StateSchema,
});

const v4EnvelopeSchema = z.object({
  schemaVersion: z.literal(4),
  updatedAt: isoDateTimeSchema,
  data: v4StateSchema,
});

const v3EnvelopeSchema = z.object({
  schemaVersion: z.literal(3),
  updatedAt: isoDateTimeSchema,
  data: v3StateSchema,
});

const v2EnvelopeSchema = z.object({
  schemaVersion: z.literal(2),
  updatedAt: isoDateTimeSchema,
  data: v3StateSchema,
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
    const deferUntil = task.status === "done" ? null : task.deferUntil;
    const recurrence =
      task.status === "done" ||
      (task.status === "later" &&
        task.recurrence !== null &&
        deferUntil === null)
        ? null
        : task.recurrence;

    tasks[id] = {
      ...task,
      id,
      title: task.title.trim(),
      personId:
        task.personId !== null && people[task.personId]
          ? task.personId
          : null,
      deferUntil,
      recurrence,
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

  const dayPlan: DayPlan | null =
    state.dayPlan === null
      ? null
      : {
          ...state.dayPlan,
          focusRoomMinutes: Math.min(
            480,
            Math.max(30, Math.round(state.dayPlan.focusRoomMinutes)),
          ),
        };

  const calendar: CalendarState = {
    events: [...state.calendar.events]
      .filter(
        (event) =>
          Date.parse(event.endAt) > Date.parse(event.startAt) &&
          event.title.trim().length > 0,
      )
      .sort(
        (left, right) =>
          Date.parse(left.startAt) - Date.parse(right.startAt) ||
          left.title.localeCompare(right.title),
      ),
    importedAt: state.calendar.importedAt,
    sourceLabel: state.calendar.sourceLabel?.trim() || null,
  };

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
    dayPlan,
    calendar,
    notifications: {
      readyAgain: state.notifications.readyAgain,
      lastReadyAgainNotifiedDate:
        state.notifications.lastReadyAgainNotifiedDate,
    },
    workday: {
      startHour: state.workday.startHour,
      endHour: state.workday.endHour,
    },
  };
}

export function parseDayDockState(value: unknown): DayDockState | null {
  const parsed = dayDockStateSchema.safeParse(value);
  return parsed.success ? normalizeDayDockState(parsed.data) : null;
}

function withDefaultWorkday(
  state: z.infer<typeof v6StateSchema>,
): DayDockState {
  return {
    ...state,
    workday: {
      startHour: 8,
      endHour: 18,
    },
  };
}

function withDefaultNotifications(
  state: z.infer<typeof v5StateSchema>,
): DayDockState {
  return {
    ...state,
    notifications: {
      readyAgain: false,
      lastReadyAgainNotifiedDate: null,
    },
    workday: {
      startHour: 8,
      endHour: 18,
    },
  };
}

function withEmptyCalendar(
  state: z.infer<typeof v4StateSchema>,
): DayDockState {
  return {
    ...state,
    calendar: {
      events: [],
      importedAt: null,
      sourceLabel: null,
    },
    notifications: {
      readyAgain: false,
      lastReadyAgainNotifiedDate: null,
    },
    workday: {
      startHour: 8,
      endHour: 18,
    },
  };
}

function withEmptyDayPlan(
  state: z.infer<typeof v3StateSchema>,
): DayDockState {
  return {
    ...state,
    dayPlan: null,
    calendar: {
      events: [],
      importedAt: null,
      sourceLabel: null,
    },
    notifications: {
      readyAgain: false,
      lastReadyAgainNotifiedDate: null,
    },
    workday: {
      startHour: 8,
      endHour: 18,
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
    dayPlan: null,
    calendar: {
      events: [],
      importedAt: null,
      sourceLabel: null,
    },
    notifications: {
      readyAgain: false,
      lastReadyAgainNotifiedDate: null,
    },
    workday: {
      startHour: 8,
      endHour: 18,
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

  const current = v7EnvelopeSchema.safeParse(parsed);

  if (current.success) {
    return {
      state: normalizeDayDockState(current.data.data),
      source: "stored",
    };
  }

  const v6 = v6EnvelopeSchema.safeParse(parsed);

  if (v6.success) {
    const state = normalizeDayDockState(withDefaultWorkday(v6.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  const v5 = v5EnvelopeSchema.safeParse(parsed);

  if (v5.success) {
    const state = normalizeDayDockState(withDefaultNotifications(v5.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  const v4 = v4EnvelopeSchema.safeParse(parsed);

  if (v4.success) {
    const state = normalizeDayDockState(withEmptyCalendar(v4.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  const v3 = v3EnvelopeSchema.safeParse(parsed);

  if (v3.success) {
    const state = normalizeDayDockState(withEmptyDayPlan(v3.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
  }

  const v2 = v2EnvelopeSchema.safeParse(parsed);

  if (v2.success) {
    const state = normalizeDayDockState(withEmptyDayPlan(v2.data.data));
    saveDayDockWorkspace(state, storage, now);
    return { state, source: "migrated" };
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
  let persistenceStatus: PersistenceStatus = "durable";
  const store = createDayDockStore(loaded.state, {
    getPersistenceStatus: () => persistenceStatus,
  });

  store.subscribe(() => {
    persistenceStatus = saveDayDockWorkspace(store.getSnapshot(), storage, now)
      ? "durable"
      : "degraded";
  });

  return store;
}
