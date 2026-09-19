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

  it("migrates schema v0 to the current envelope", () => {
    const storage = new MemoryStorage();
    const state = stateWithTasks([task("a")]);

    storage.setItem(
      DAYDOCK_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        data: state,
      }),
    );

    const result = loadDayDockWorkspace(
      storage,
      () => "2026-09-19T12:00:00.000Z",
    );

    expect(result.source).toBe("migrated");
    expect(result.state.tasks.a?.title).toBe("Task a");

    const upgraded = JSON.parse(
      storage.getItem(DAYDOCK_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion?: number; updatedAt?: string };

    expect(upgraded.schemaVersion).toBe(DAYDOCK_SCHEMA_VERSION);
    expect(upgraded.updatedAt).toBe("2026-09-19T12:00:00.000Z");
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

  it("persists a normalized v1 envelope", () => {
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
    expect(saved.data?.tasks.a?.title).toBe("Task a");
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
});
