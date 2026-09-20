import { describe, expect, it } from "vitest";
import type { StorageLike } from "../storage/dayDockPersistence";
import { createBrowserDayDockStore } from "./browserDayDockStore";

function createMemoryStorage(): StorageLike & { read: () => string | null } {
  let value: string | null = null;

  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue;
    },
    read: () => value,
  };
}

describe("createBrowserDayDockStore", () => {
  it("falls back to an in-memory store when browser storage access throws", () => {
    const store = createBrowserDayDockStore({
      getStorage: () => {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });

    store.dispatch({
      type: "task/captured",
      task: {
        id: "fallback-task",
        title: "Keep the app usable",
        status: "inbox",
        estimateMinutes: null,
        personId: null,
        createdAt: "2026-09-20T09:00:00.000Z",
        completedAt: null,
      },
    });

    expect(store.getSnapshot().tasks["fallback-task"]?.title).toBe(
      "Keep the app usable",
    );
  });

  it("keeps durable persistence when BroadcastChannel construction fails", () => {
    const storage = createMemoryStorage();
    const store = createBrowserDayDockStore({
      getStorage: () => storage,
      createChannel: () => {
        throw new Error("BroadcastChannel unavailable");
      },
    });

    store.dispatch({
      type: "task/captured",
      task: {
        id: "persisted-task",
        title: "Persist without live sync",
        status: "inbox",
        estimateMinutes: null,
        personId: null,
        createdAt: "2026-09-20T09:00:00.000Z",
        completedAt: null,
      },
    });

    expect(storage.read()).toContain("persisted-task");
  });
});
