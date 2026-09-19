import { describe, expect, it } from "vitest";
import type { Task } from "../domain/daydock/model";
import {
  DAYDOCK_STORAGE_KEY,
  loadDayDockWorkspace,
  type StorageLike,
} from "../storage/dayDockPersistence";
import {
  createSynchronizedDayDockStore,
  type BroadcastChannelLike,
  type BroadcastMessageEventLike,
} from "./synchronizedDayDockStore";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeBroadcastBus {
  readonly channels = new Set<FakeBroadcastChannel>();
  posts = 0;

  connect(): FakeBroadcastChannel {
    const channel = new FakeBroadcastChannel(this);
    this.channels.add(channel);
    return channel;
  }

  deliver(sender: FakeBroadcastChannel, message: unknown): void {
    this.posts += 1;

    for (const channel of this.channels) {
      if (channel === sender || channel.closed) continue;
      channel.onmessage?.({ data: structuredClone(message) });
    }
  }

  disconnect(channel: FakeBroadcastChannel): void {
    this.channels.delete(channel);
  }
}

class FakeBroadcastChannel implements BroadcastChannelLike {
  onmessage: ((event: BroadcastMessageEventLike) => void) | null = null;
  closed = false;

  constructor(private readonly bus: FakeBroadcastBus) {}

  postMessage(message: unknown): void {
    if (this.closed) throw new Error("Channel is closed.");
    this.bus.deliver(this, message);
  }

  close(): void {
    this.closed = true;
    this.bus.disconnect(this);
  }
}

function task(id: string, title = `Task ${id}`): Task {
  return {
    id,
    title,
    status: "inbox",
    estimateMinutes: null,
    personId: null,
    createdAt: "2026-09-19T08:00:00.000Z",
    completedAt: null,
  };
}

describe("cross-tab DayDock synchronization", () => {
  it("syncs validated snapshots without broadcast echo loops", () => {
    const storage = new MemoryStorage();
    const bus = new FakeBroadcastBus();

    const first = createSynchronizedDayDockStore({
      storage,
      channel: bus.connect(),
      sourceId: "tab-a",
      nowMs: () => 100,
      now: () => "2026-09-19T10:00:00.000Z",
    });

    const second = createSynchronizedDayDockStore({
      storage,
      channel: bus.connect(),
      sourceId: "tab-b",
      nowMs: () => 100,
      now: () => "2026-09-19T10:00:01.000Z",
    });

    first.store.dispatch({
      type: "task/captured",
      task: task("a", "Review architecture"),
    });

    expect(second.store.getSnapshot().tasks.a?.title).toBe("Review architecture");
    expect(bus.posts).toBe(1);

    second.store.dispatch({
      type: "task/renamed",
      taskId: "a",
      title: "Review final architecture",
    });

    expect(first.store.getSnapshot().tasks.a?.title).toBe(
      "Review final architecture",
    );
    expect(bus.posts).toBe(2);

    const persisted = loadDayDockWorkspace(storage);
    expect(persisted.state.tasks.a?.title).toBe("Review final architecture");

    first.dispose();
    second.dispose();
  });

  it("ignores stale and structurally invalid remote snapshots", () => {
    const storage = new MemoryStorage();
    const bus = new FakeBroadcastBus();
    const primaryChannel = bus.connect();

    const primary = createSynchronizedDayDockStore({
      storage,
      channel: primaryChannel,
      sourceId: "tab-a",
      nowMs: () => 200,
    });

    primary.store.dispatch({
      type: "task/captured",
      task: task("a", "Keep this task"),
    });

    const outsider = bus.connect();

    outsider.postMessage({
      kind: "daydock/workspace",
      sourceId: "tab-z",
      revision: {
        timestampMs: 100,
        sourceId: "tab-z",
      },
      state: {
        tasks: {},
      },
    });

    expect(primary.store.getSnapshot().tasks.a?.title).toBe("Keep this task");

    outsider.postMessage({
      kind: "daydock/workspace",
      sourceId: "tab-z",
      revision: {
        timestampMs: 300,
        sourceId: "tab-z",
      },
      state: {
        tasks: "not-a-record",
        taskOrder: [],
        top3: [],
        people: {},
        personOrder: [],
        focus: {
          active: null,
          history: [],
        },
      },
    });

    expect(primary.store.getSnapshot().tasks.a?.title).toBe("Keep this task");

    primary.dispose();
    outsider.close();
  });

  it("uses source id as a deterministic tie-breaker for equal revisions", () => {
    const storage = new MemoryStorage();
    const bus = new FakeBroadcastBus();

    const primary = createSynchronizedDayDockStore({
      storage,
      channel: bus.connect(),
      sourceId: "tab-b",
      nowMs: () => 500,
    });

    primary.store.dispatch({
      type: "task/captured",
      task: task("a", "Local title"),
    });

    const outsider = bus.connect();

    outsider.postMessage({
      kind: "daydock/workspace",
      sourceId: "tab-a",
      revision: {
        timestampMs: 500,
        sourceId: "tab-a",
      },
      state: primary.store.getSnapshot(),
    });

    expect(primary.store.getSnapshot().tasks.a?.title).toBe("Local title");

    const newerState = structuredClone(primary.store.getSnapshot());
    newerState.tasks.a = {
      ...newerState.tasks.a!,
      title: "Tie-break winner",
    };

    outsider.postMessage({
      kind: "daydock/workspace",
      sourceId: "tab-z",
      revision: {
        timestampMs: 500,
        sourceId: "tab-z",
      },
      state: newerState,
    });

    expect(primary.store.getSnapshot().tasks.a?.title).toBe("Tie-break winner");
    expect(storage.getItem(DAYDOCK_STORAGE_KEY)).not.toBeNull();

    primary.dispose();
    outsider.close();
  });
});
