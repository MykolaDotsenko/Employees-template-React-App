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
  parseDayDockBackup,
  saveDayDockWorkspace,
  serializeDayDockWorkspace,
  type StorageLike,
  type WorkspaceSyncChannel,
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

class TestSyncChannel implements WorkspaceSyncChannel {
  peer: TestSyncChannel | null = null;
  private readonly listeners = new Set<(message: unknown) => void>();

  postMessage(message: unknown): void {
    this.peer?.listeners.forEach((listener) => listener(message));
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function syncPair(): [TestSyncChannel, TestSyncChannel] {
  const left = new TestSyncChannel();
  const right = new TestSyncChannel();
  left.peer = right;
  right.peer = left;
  return [left, right];
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

  it("migrates schema v1 to v2 with an empty focus state", () => {
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

  it("serializes and parses a portable validated backup", () => {
    const state = stateWithTasks([task("a", "inbox")]);
    const raw = serializeDayDockWorkspace(
      state,
      () => "2026-09-19T13:00:00.000Z",
    );

    const restored = parseDayDockBackup(raw);

    expect(restored?.tasks.a?.title).toBe("Task a");
    expect(restored?.tasks.a?.status).toBe("inbox");
    expect(parseDayDockBackup("{invalid")).toBeNull();
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

  it("syncs validated workspace changes across channels without echo loops", () => {
    const [leftChannel, rightChannel] = syncPair();

    const left = createPersistentDayDockStore({
      storage: new MemoryStorage(),
      syncChannel: leftChannel,
      sourceId: "left",
      now: () => "2026-09-19T15:00:00.000Z",
    });
    const right = createPersistentDayDockStore({
      storage: new MemoryStorage(),
      syncChannel: rightChannel,
      sourceId: "right",
      now: () => "2026-09-19T15:00:00.000Z",
    });

    left.dispatch({
      type: "task/captured",
      task: task("shared", "inbox"),
    });

    expect(right.getSnapshot().tasks.shared?.title).toBe("Task shared");

    right.dispatch({
      type: "task/renamed",
      taskId: "shared",
      title: "Updated in another tab",
    });

    expect(left.getSnapshot().tasks.shared?.title).toBe(
      "Updated in another tab",
    );
  });
});
