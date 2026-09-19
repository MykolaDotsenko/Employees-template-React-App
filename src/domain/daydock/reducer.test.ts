import { describe, expect, it } from "vitest";
import { createInitialDayDockState, type Person, type Task } from "./model";
import { dayDockReducer } from "./reducer";
import { selectFollowUpsDue, selectTop3 } from "./selectors";

function task(
  id: string,
  status: Task["status"] = "inbox",
): Task {
  return {
    id,
    title: `Task ${id}`,
    status,
    estimateMinutes: null,
    personId: null,
    createdAt: "2026-09-19T08:00:00.000Z",
    completedAt: null,
  };
}

function person(id: string, nextFollowUpDate: string | null): Person {
  return {
    id,
    name: `Person ${id}`,
    context: "",
    nextFollowUpDate,
    createdAt: "2026-09-19T08:00:00.000Z",
  };
}

describe("dayDockReducer", () => {
  it("captures a task without accepting a duplicate id", () => {
    const initial = createInitialDayDockState();
    const captured = dayDockReducer(initial, {
      type: "task/captured",
      task: task("a"),
    });

    const duplicate = dayDockReducer(captured, {
      type: "task/captured",
      task: { ...task("a"), title: "Duplicate" },
    });

    expect(captured.taskOrder).toEqual(["a"]);
    expect(duplicate).toBe(captured);
  });

  it("enforces a maximum of three Top 3 tasks", () => {
    let state = createInitialDayDockState();

    for (const id of ["a", "b", "c", "d"]) {
      state = dayDockReducer(state, {
        type: "task/captured",
        task: task(id, "today"),
      });
      state = dayDockReducer(state, { type: "top3/added", taskId: id });
    }

    expect(state.top3).toEqual(["a", "b", "c"]);
    expect(selectTop3(state).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("only lets today tasks enter Top 3", () => {
    const state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "inbox"),
    });

    const unchanged = dayDockReducer(state, {
      type: "top3/added",
      taskId: "a",
    });

    expect(unchanged).toBe(state);
  });

  it("removes a task from Top 3 when it leaves Today", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "today"),
    });
    state = dayDockReducer(state, { type: "top3/added", taskId: "a" });
    state = dayDockReducer(state, {
      type: "task/moved",
      taskId: "a",
      status: "later",
    });

    expect(state.top3).toEqual([]);
    expect(state.tasks.a?.status).toBe("later");
  });

  it("completes and reopens a task without stale completion state", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "today"),
    });
    state = dayDockReducer(state, { type: "top3/added", taskId: "a" });
    state = dayDockReducer(state, {
      type: "task/completed",
      taskId: "a",
      completedAt: "2026-09-19T12:00:00.000Z",
    });

    expect(state.tasks.a?.status).toBe("done");
    expect(state.tasks.a?.completedAt).toBe("2026-09-19T12:00:00.000Z");
    expect(state.top3).toEqual([]);

    state = dayDockReducer(state, {
      type: "task/reopened",
      taskId: "a",
      status: "today",
    });

    expect(state.tasks.a?.status).toBe("today");
    expect(state.tasks.a?.completedAt).toBeNull();
  });

  it("does not attach a task to an unknown person", () => {
    const state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a"),
    });

    const unchanged = dayDockReducer(state, {
      type: "task/personAttached",
      taskId: "a",
      personId: "missing",
    });

    expect(unchanged).toBe(state);
  });

  it("selects due follow-ups in deterministic person order", () => {
    let state = createInitialDayDockState();

    for (const entry of [
      person("a", "2026-09-18"),
      person("b", "2026-09-20"),
      person("c", "2026-09-19"),
    ]) {
      state = dayDockReducer(state, { type: "person/added", person: entry });
    }

    expect(
      selectFollowUpsDue(state, "2026-09-19").map((entry) => entry.id),
    ).toEqual(["a", "c"]);
  });
});
