import { describe, expect, it } from "vitest";
import { createInitialDayDockState, type Task } from "./model";
import { dayDockReducer } from "./reducer";
import { selectOpenTasksForPerson, selectPeople } from "./selectors";

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
