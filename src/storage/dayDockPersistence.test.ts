import { describe, expect, it } from "vitest";
import {
  createInitialDayDockState,
  type DayDockState,
  type Task,
} from "../domain/daydock/model";
import {
  DAYDOCK_SCHEMA_VERSION,
  DAYDOCK_STORAGE_KEY,
  createPersistentDayDockStore,
  loadDayDockWorkspace,
  saveDayDockWorkspace,
  type StorageLike,
} from "./dayDockPersistence";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function task(id: string, status: Task["status"] = "today"): Task {
  return {
    id,
    title: `Task ${id}`,
    status,
    estimateMinutes: 30,
    personId: null,
    deferUntil: null,
    recurrence: null,
    createdAt: "2026-09-19T08:00:00.000Z",
    completedAt:
      status === "done" ? "2026-09-19T09:00:00.000Z" : null,
  };
}

function stateWithTasks(tasks: Task[]): DayDockState {
  const state = createInitialDayDockState();

  return {
    ...state,
    tasks: Object.fromEntries(tasks.map((entry) => [entry.id, entry])),
    taskOrder: tasks.map((entry) => entry.id),
  };
}

describe("DayDock persistence", () => {
  it("returns a clean workspace when JSON is corrupted", () => {
    const storage = new MemoryStorage();
    storage.setItem(DAYDOCK_STORAGE_KEY, "{not-json");

    const result = loadDayDockWorkspace(storage);

    expect(result.source).toBe("recovered");
    expect(result.state).toEqual(createInitialDayDockState());
  });

  it("refuses unknown future schemas instead of silently downgrading", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 99,
        updatedAt: "2026-09-19T10:00:00.000Z",
        data: createInitialDayDockState(),
      }),
    );

    const result = loadDayDockWorkspace(storage);

    expect(result.source).toBe("recovered");
    expect(result.state).toEqual(createInitialDayDockState());
  });

  it("migrates schema v4 to schema v5 with empty calendar context", () => {
    const storage = new MemoryStorage();
    const state = createInitialDayDockState();
    const { calendar: _calendar, ...v4Data } = state;

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        updatedAt: "2026-09-20T08:00:00.000Z",
        data: v4Data,
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-20T09:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.calendar).toEqual({
      events: [],
      importedAt: null,
      sourceLabel: null,
    });

    const upgraded = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion?: number };

    expect(upgraded.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
  });

  it("migrates schema v1 to the current schema with an empty focus state", () => {
    const storage = new MemoryStorage();
    const state = stateWithTasks([task("a")]);
    const legacyData = {
      tasks: state.tasks,
      taskOrder: state.taskOrder,
      top3: state.top3,
      people: state.people,
      personOrder: state.personOrder,
    };

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: "2026-09-19T11:00:00.000Z",
        data: legacyData,
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-19T12:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.focus).toEqual({ active: null, history: [] });

    const upgraded = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion?: number };

    expect(upgraded.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
  });

  it("migrates schema v0 directly to the current envelope", () => {
    const storage = new MemoryStorage();
    const state = stateWithTasks([task("a")]);
    const legacyData = {
      tasks: state.tasks,
      taskOrder: state.taskOrder,
      top3: state.top3,
      people: state.people,
      personOrder: state.personOrder,
    };

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        data: legacyData,
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-19T12:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.tasks.a?.title).toBe("Task a");
  });

  it("normalizes ordering, Top 3 and broken person references", () => {
    const storage = new MemoryStorage();
    const today = { ...task("today"), personId: "missing" };
    const later = task("later", "later");

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: DAYDOCK_SCHEMA_VERSION,
        updatedAt: "2026-09-19T10:00:00.000Z",
        data: {
          ...stateWithTasks([today, later]),
          taskOrder: ["later", "later", "missing"],
          top3: ["later", "today", "today"],
        },
      }),
    );

    const result = loadDayDockWorkspace(storage);

    expect(result.source).toBe("stored");
    expect(result.state.taskOrder).toEqual(["later", "today"]);
    expect(result.state.top3).toEqual(["today"]);
    expect(result.state.tasks.today?.personId).toBeNull();
  });

  it("drops an active focus session when its task is no longer Today", () => {
    const storage = new MemoryStorage();
    const later = task("later", "later");

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: DAYDOCK_SCHEMA_VERSION,
        updatedAt: "2026-09-19T10:00:00.000Z",
        data: {
          ...stateWithTasks([later]),
          focus: {
            active: {
              id: "focus-a",
              taskId: "later",
              startedAt: "2026-09-19T09:00:00.000Z",
              durationMinutes: 50,
              pausedAt: null,
              accumulatedPauseMs: 0,
            },
            history: [],
          },
        },
      }),
    );

    const result = loadDayDockWorkspace(storage);
    expect(result.state.focus.active).toBeNull();
  });

  it("persists a normalized current envelope", () => {
    const storage = new MemoryStorage();
    const state = stateWithTasks([task("a")]);

    expect(
      saveDayDockWorkspace(
        state,
        storage,
        () => "2026-09-19T13:00:00.000Z",
      ),
    ).toBe(true);

    const saved = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as {
      schemaVersion?: number;
      updatedAt?: string;
      data?: DayDockState;
    };

    expect(saved.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
    expect(saved.updatedAt).toBe("2026-09-19T13:00:00.000Z");
    expect(saved.data?.focus).toEqual({ active: null, history: [] });
    expect(saved.data?.dayPlan).toBeNull();
  });

  it("persists external-store changes but ignores no-op actions", () => {
    const storage = new MemoryStorage();
    const store = createPersistentDayDockStore({
      storage,
      now: () => "2026-09-19T14:00:00.000Z",
    });

    store.dispatch({ type: "top3/added", taskId: "missing" });
    expect(storage.getItem(DAYDOCK_STORAGE_KEY)).toBeNull();

    store.dispatch({
      type: "task/captured",
      task: task("a", "inbox"),
    });

    const result = loadDayDockWorkspace(storage);
    expect(result.source).toBe("stored");
    expect(result.state.tasks.a?.status).toBe("inbox");
  });

  it("reports a degraded state when a browser write fails and recovers after a later successful write", () => {
    let shouldFail = true;
    let stored: string | null = null;
    const storage: StorageLike = {
      getItem: () => stored,
      setItem: (_key, value) => {
        if (shouldFail) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        stored = value;
      },
    };
    const store = createPersistentDayDockStore({ storage });

    store.dispatch({
      type: "task/captured",
      task: task("quota", "inbox"),
    });

    expect(store.getPersistenceStatus()).toBe("degraded");
    expect(store.getSnapshot().tasks.quota).toBeDefined();

    shouldFail = false;
    store.dispatch({
      type: "task/renamed",
      taskId: "quota",
      title: "Task quota recovered",
    });

    expect(store.getPersistenceStatus()).toBe("durable");
    expect(stored).toContain("Task quota recovered");
  });


  it("migrates schema v3 workspaces with an empty day plan", () => {
    const storage = new MemoryStorage();
    const state = stateWithTasks([task("a")]);
    const v3Data = {
      tasks: state.tasks,
      taskOrder: state.taskOrder,
      top3: state.top3,
      people: state.people,
      personOrder: state.personOrder,
      focus: state.focus,
    };

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 3,
        updatedAt: "2026-09-20T08:00:00.000Z",
        data: v3Data,
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-20T09:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.dayPlan).toBeNull();

    const upgraded = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion?: number };

    expect(upgraded.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
  });

  it("migrates schema v2 tasks without scheduling fields into the current schema", () => {
    const storage = new MemoryStorage();

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: "2026-09-20T08:00:00.000Z",
        data: {
          tasks: {
            legacy: {
              id: "legacy",
              title: "Legacy deferred thought",
              status: "later",
              estimateMinutes: null,
              personId: null,
              createdAt: "2026-09-19T08:00:00.000Z",
              completedAt: null,
            },
          },
          taskOrder: ["legacy"],
          top3: [],
          people: {},
          personOrder: [],
          focus: {
            active: null,
            history: [],
          },
        },
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-20T09:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.tasks.legacy).toMatchObject({
      deferUntil: null,
      recurrence: null,
    });

    const upgraded = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion?: number };

    expect(upgraded.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
  });

});
