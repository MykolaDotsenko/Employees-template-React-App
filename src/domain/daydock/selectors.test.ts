import { describe, expect, it } from "vitest";
import { createInitialDayDockState, type Task } from "./model";
import { dayDockReducer } from "./reducer";
import {
  selectOpenTasksForPerson,
  selectPeople,
  selectReviewSnapshot,
} from "./selectors";

function task(id: string, personId: string | null, status: Task["status"]): Task {
  return {
    id,
    title: `Task ${id}`,
    status,
    estimateMinutes: null,
    personId,
    createdAt: "2026-09-19T08:00:00.000Z",
    completedAt: status === "done" ? "2026-09-19T09:00:00.000Z" : null,
  };
}

describe("people selectors", () => {
  it("keeps person order and derives only open linked tasks", () => {
    let state = createInitialDayDockState();

    state = dayDockReducer(state, {
      type: "person/added",
      person: {
        id: "anna",
        name: "Anna",
        context: "Design feedback",
        nextFollowUpDate: "2026-09-20",
        createdAt: "2026-09-19T08:00:00.000Z",
      },
    });

    for (const entry of [
      task("a", "anna", "inbox"),
      task("b", "anna", "done"),
      task("c", null, "today"),
    ]) {
      state = dayDockReducer(state, { type: "task/captured", task: entry });
    }

    expect(selectPeople(state).map((person) => person.id)).toEqual(["anna"]);
    expect(selectOpenTasksForPerson(state, "anna").map((entry) => entry.id)).toEqual([
      "a",
    ]);
  });
});

describe("review selectors", () => {
  it("derives a day review from task and focus history without stored analytics", () => {
    let state = createInitialDayDockState();

    for (const entry of [
      task("done-in-window", null, "done"),
      task("done-before-window", null, "done"),
      task("open-today", null, "today"),
      task("inbox", null, "inbox"),
    ]) {
      state = dayDockReducer(state, { type: "task/captured", task: entry });
    }

    state = {
      ...state,
      tasks: {
        ...state.tasks,
        "done-in-window": {
          ...state.tasks["done-in-window"]!,
          completedAt: "2026-09-19T10:00:00.000Z",
        },
        "done-before-window": {
          ...state.tasks["done-before-window"]!,
          completedAt: "2026-09-18T10:00:00.000Z",
        },
      },
      focus: {
        active: null,
        history: [
          {
            id: "focus-in-window",
            taskId: "open-today",
            startedAt: "2026-09-19T09:00:00.000Z",
            durationMinutes: 50,
            pausedAt: null,
            accumulatedPauseMs: 5 * 60_000,
            endedAt: "2026-09-19T09:35:00.000Z",
            outcome: "stopped",
          },
          {
            id: "focus-before-window",
            taskId: "open-today",
            startedAt: "2026-09-18T09:00:00.000Z",
            durationMinutes: 50,
            pausedAt: null,
            accumulatedPauseMs: 0,
            endedAt: "2026-09-18T09:30:00.000Z",
            outcome: "stopped",
          },
        ],
      },
    };

    const snapshot = selectReviewSnapshot(state, {
      startMs: Date.parse("2026-09-19T00:00:00.000Z"),
      endMs: Date.parse("2026-09-20T00:00:00.000Z"),
      todayKey: "2026-09-19",
    });

    expect(snapshot.completedTasks.map((entry) => entry.id)).toEqual([
      "done-in-window",
    ]);
    expect(snapshot.focusSessions.map((session) => session.id)).toEqual([
      "focus-in-window",
    ]);
    expect(snapshot.focusMs).toBe(30 * 60_000);
    expect(snapshot.openTodayTasks.map((entry) => entry.id)).toEqual([
      "open-today",
    ]);
    expect(snapshot.inboxCount).toBe(1);
  });
});
