import { describe, expect, it, vi } from "vitest";
import { createDayDockStore } from "./dayDockStore";

describe("createDayDockStore", () => {
  it("notifies subscribers only when the reducer changes state", () => {
    const store = createDayDockStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: "top3/added", taskId: "missing" });
    expect(listener).not.toHaveBeenCalled();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "a",
        title: "Write architecture notes",
        status: "inbox",
        estimateMinutes: 30,
        personId: null,
        createdAt: "2026-09-19T08:00:00.000Z",
        completedAt: null,
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().taskOrder).toEqual(["a"]);

    unsubscribe();

    store.dispatch({
      type: "task/renamed",
      taskId: "a",
      title: "Write final architecture notes",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
