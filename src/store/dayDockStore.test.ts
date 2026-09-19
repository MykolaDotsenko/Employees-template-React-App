import { describe, expect, it, vi } from "vitest";
import { createInitialDayDockState } from "../domain/daydock/model";
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

  it("can replace a validated snapshot through the store boundary", () => {
    const store = createDayDockStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const replacement = createInitialDayDockState();
    replacement.people.anna = {
      id: "anna",
      name: "Anna",
      context: "Design review",
      nextFollowUpDate: null,
      createdAt: "2026-09-19T08:00:00.000Z",
    };
    replacement.personOrder.push("anna");

    store.replaceSnapshot(replacement);

    expect(store.getSnapshot()).toBe(replacement);
    expect(store.getSnapshot().people.anna?.name).toBe("Anna");
    expect(listener).toHaveBeenCalledTimes(1);

    store.replaceSnapshot(replacement);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
