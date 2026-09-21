import { describe, expect, it } from "vitest";
import {
  createInitialDayDockState,
  type ActiveFocusSession,
  type Person,
  type Task,
} from "./model";
import { dayDockReducer } from "./reducer";
import { selectFollowUpsDue, selectTop3 } from "./selectors";

function task(id: string, status: Task["status"] = "inbox"): Task {
  return {
    id,
    title: `Task ${id}`,
    status,
    estimateMinutes: null,
    personId: null,
    deferUntil: null,
    recurrence: null,
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

function focusSession(taskId: string): ActiveFocusSession {
  return {
    id: "focus-a",
    taskId,
    startedAt: "2026-09-19T10:00:00.000Z",
    durationMinutes: 50,
    pausedAt: null,
    accumulatedPauseMs: 0,
  };
}

describe("dayDockReducer", () => {
  it("replaces and clears validated local calendar context", () => {
    const state = createInitialDayDockState();
    const imported = dayDockReducer(state, {
      type: "calendar/replaced",
      events: [
        {
          id: "meeting-1",
          title: "Design review",
          startAt: "2026-09-20T09:00:00.000Z",
          endAt: "2026-09-20T09:45:00.000Z",
          allDay: false,
          source: "ics",
        },
      ],
      importedAt: "2026-09-20T07:00:00.000Z",
      sourceLabel: "work.ics",
    });

    expect(imported.calendar.events).toHaveLength(1);
    expect(imported.calendar.sourceLabel).toBe("work.ics");

    const invalid = dayDockReducer(imported, {
      type: "calendar/replaced",
      events: [
        {
          id: "broken",
          title: "Broken",
          startAt: "2026-09-20T10:00:00.000Z",
          endAt: "2026-09-20T09:00:00.000Z",
          allDay: false,
          source: "ics",
        },
      ],
      importedAt: "2026-09-20T07:00:00.000Z",
      sourceLabel: "broken.ics",
    });

    expect(invalid).toBe(imported);
    expect(dayDockReducer(imported, { type: "calendar/cleared" }).calendar)
      .toEqual({
        events: [],
        importedAt: null,
        sourceLabel: null,
      });
  });

  it("stores valid half-hour workday preferences and rejects invalid ranges", () => {
    const state = createInitialDayDockState();

    const changed = dayDockReducer(state, {
      type: "workday/changed",
      startHour: 8.5,
      endHour: 17.5,
    });

    expect(changed.workday).toEqual({
      startHour: 8.5,
      endHour: 17.5,
    });

    expect(
      dayDockReducer(changed, {
        type: "workday/changed",
        startHour: 17.5,
        endHour: 8.5,
      }),
    ).toBe(changed);

    expect(
      dayDockReducer(changed, {
        type: "workday/changed",
        startHour: 8.25,
        endHour: 17.5,
      }),
    ).toBe(changed);
  });

  it("stores one bounded daily focus plan", () => {
    const state = createInitialDayDockState();
    const planned = dayDockReducer(state, {
      type: "day/started",
      plan: {
        dateKey: "2026-09-20",
        focusRoomMinutes: 150,
        startedAt: "2026-09-20T07:00:00.000Z",
      },
    });

    expect(planned.dayPlan).toEqual({
      dateKey: "2026-09-20",
      focusRoomMinutes: 150,
      startedAt: "2026-09-20T07:00:00.000Z",
    });

    const zeroFocusPlan = dayDockReducer(planned, {
      type: "day/started",
      plan: {
        dateKey: "2026-09-21",
        focusRoomMinutes: 0,
        startedAt: "2026-09-21T07:00:00.000Z",
      },
    });

    expect(zeroFocusPlan.dayPlan?.focusRoomMinutes).toBe(0);

    expect(
      dayDockReducer(zeroFocusPlan, {
        type: "day/started",
        plan: {
          dateKey: "2026-09-20",
          focusRoomMinutes: 900,
          startedAt: "2026-09-20T07:00:00.000Z",
        },
      }),
    ).toBe(zeroFocusPlan);
  });

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

  it("keeps person follow-up dates valid and updateable", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "person/added",
      person: person("a", "2026-09-20"),
    });

    state = dayDockReducer(state, {
      type: "person/followUpChanged",
      personId: "a",
      nextFollowUpDate: "2026-09-21",
    });

    expect(state.people.a?.nextFollowUpDate).toBe("2026-09-21");

    const unchanged = dayDockReducer(state, {
      type: "person/followUpChanged",
      personId: "a",
      nextFollowUpDate: "2026-02-31",
    });

    expect(unchanged).toBe(state);
  });

  it("starts, pauses and resumes a focus session deterministically", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "today"),
    });

    state = dayDockReducer(state, {
      type: "focus/started",
      session: focusSession("a"),
    });
    state = dayDockReducer(state, {
      type: "focus/paused",
      pausedAt: "2026-09-19T10:10:00.000Z",
    });
    state = dayDockReducer(state, {
      type: "focus/resumed",
      resumedAt: "2026-09-19T10:15:00.000Z",
    });

    expect(state.focus.active?.pausedAt).toBeNull();
    expect(state.focus.active?.accumulatedPauseMs).toBe(5 * 60_000);
  });

  it("prevents an active focus task from being moved away from Today", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "today"),
    });
    state = dayDockReducer(state, {
      type: "focus/started",
      session: focusSession("a"),
    });

    const unchanged = dayDockReducer(state, {
      type: "task/moved",
      taskId: "a",
      status: "later",
    });

    expect(unchanged).toBe(state);
  });

  it("completing the focused task closes the session into history", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("a", "today"),
    });
    state = dayDockReducer(state, {
      type: "focus/started",
      session: focusSession("a"),
    });
    state = dayDockReducer(state, {
      type: "task/completed",
      taskId: "a",
      completedAt: "2026-09-19T10:20:00.000Z",
    });

    expect(state.focus.active).toBeNull();
    expect(state.focus.history).toHaveLength(1);
    expect(state.focus.history[0]?.outcome).toBe("completed");
    expect(state.focus.history[0]?.endedAt).toBe("2026-09-19T10:20:00.000Z");
  });

  it("removes an open task without leaving Top 3 or focus-history ghosts", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("remove-me", "today"),
    });
    state = dayDockReducer(state, {
      type: "top3/added",
      taskId: "remove-me",
    });
    state = dayDockReducer(state, {
      type: "focus/started",
      session: focusSession("remove-me"),
    });
    state = dayDockReducer(state, {
      type: "focus/finished",
      endedAt: "2026-09-19T10:20:00.000Z",
      outcome: "stopped",
    });

    expect(state.focus.history).toHaveLength(1);

    state = dayDockReducer(state, {
      type: "task/removed",
      taskId: "remove-me",
    });

    expect(state.tasks["remove-me"]).toBeUndefined();
    expect(state.taskOrder).not.toContain("remove-me");
    expect(state.top3).not.toContain("remove-me");
    expect(state.focus.history).toHaveLength(0);
  });

  it("does not remove completed work or the task in an active focus session", () => {
    let doneState = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("done-task", "today"),
    });
    doneState = dayDockReducer(doneState, {
      type: "task/completed",
      taskId: "done-task",
      completedAt: "2026-09-19T10:00:00.000Z",
    });

    expect(
      dayDockReducer(doneState, {
        type: "task/removed",
        taskId: "done-task",
      }),
    ).toBe(doneState);

    let focusedState = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("focused-task", "today"),
    });
    focusedState = dayDockReducer(focusedState, {
      type: "focus/started",
      session: focusSession("focused-task"),
    });

    expect(
      dayDockReducer(focusedState, {
        type: "task/removed",
        taskId: "focused-task",
      }),
    ).toBe(focusedState);
  });


  it("renames a person and keeps linked task relationships intact", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "person/added",
      person: person("anna", null),
    });
    state = dayDockReducer(state, {
      type: "task/captured",
      task: {
        ...task("linked", "inbox"),
        personId: "anna",
      },
    });

    state = dayDockReducer(state, {
      type: "person/renamed",
      personId: "anna",
      name: "Anna Rivera",
    });

    expect(state.people.anna?.name).toBe("Anna Rivera");
    expect(state.tasks.linked?.personId).toBe("anna");
  });

  it("removes a person without deleting their linked work", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "person/added",
      person: person("anna", "2026-09-20"),
    });
    state = dayDockReducer(state, {
      type: "task/captured",
      task: {
        ...task("linked", "inbox"),
        title: "Keep this commitment",
        personId: "anna",
      },
    });

    state = dayDockReducer(state, {
      type: "person/removed",
      personId: "anna",
    });

    expect(state.people.anna).toBeUndefined();
    expect(state.personOrder).not.toContain("anna");
    expect(state.tasks.linked?.title).toBe("Keep this commitment");
    expect(state.tasks.linked?.personId).toBeNull();
  });


  it("parks work with a return date and removes it from Top 3", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("scheduled", "today"),
    });
    state = dayDockReducer(state, {
      type: "top3/added",
      taskId: "scheduled",
    });

    state = dayDockReducer(state, {
      type: "task/deferred",
      taskId: "scheduled",
      deferUntil: "2026-09-21",
      recurrence: null,
    });

    expect(state.tasks.scheduled).toMatchObject({
      status: "later",
      deferUntil: "2026-09-21",
      recurrence: null,
    });
    expect(state.top3).toEqual([]);
  });

  it("returns due deferred work to Inbox while future work stays quiet", () => {
    let state = createInitialDayDockState();

    for (const [id, date] of [
      ["ready", "2026-09-20"],
      ["future", "2026-09-22"],
    ] as const) {
      state = dayDockReducer(state, {
        type: "task/captured",
        task: {
          ...task(id, "later"),
          deferUntil: date,
        },
      });
    }

    state = dayDockReducer(state, {
      type: "task/resurfaceDue",
      dateKey: "2026-09-20",
    });

    expect(state.tasks.ready).toMatchObject({
      status: "inbox",
      deferUntil: "2026-09-20",
    });
    expect(state.tasks.future).toMatchObject({
      status: "later",
      deferUntil: "2026-09-22",
    });
  });

  it("completes a recurring occurrence atomically and creates the next one", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: {
        ...task("repeat", "today"),
        recurrence: {
          kind: "weekly",
          anchorDate: "2026-09-14",
        },
      },
    });
    state = dayDockReducer(state, {
      type: "top3/added",
      taskId: "repeat",
    });
    state = dayDockReducer(state, {
      type: "focus/started",
      session: focusSession("repeat"),
    });

    state = dayDockReducer(state, {
      type: "task/completedWithNext",
      taskId: "repeat",
      completedAt: "2026-09-20T10:20:00.000Z",
      nextTask: {
        ...task("repeat-next", "later"),
        title: "Task repeat",
        deferUntil: "2026-09-21",
        recurrence: {
          kind: "weekly",
          anchorDate: "2026-09-14",
        },
        createdAt: "2026-09-20T10:20:00.000Z",
      },
    });

    expect(state.tasks.repeat).toMatchObject({
      status: "done",
      recurrence: null,
      deferUntil: null,
      completedAt: "2026-09-20T10:20:00.000Z",
    });
    expect(state.tasks["repeat-next"]).toMatchObject({
      status: "later",
      deferUntil: "2026-09-21",
      recurrence: {
        kind: "weekly",
        anchorDate: "2026-09-14",
      },
    });
    expect(state.taskOrder).toEqual(["repeat", "repeat-next"]);
    expect(state.top3).toEqual([]);
    expect(state.focus.active).toBeNull();
    expect(state.focus.history).toHaveLength(1);
    expect(state.focus.history[0]?.outcome).toBe("completed");
  });

  it("rejects recurrence without a concrete return date", () => {
    const state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: task("repeat", "inbox"),
    });

    const unchanged = dayDockReducer(state, {
      type: "task/deferred",
      taskId: "repeat",
      deferUntil: null,
      recurrence: {
        kind: "weekly",
        anchorDate: "2026-09-21",
      },
    });

    expect(unchanged).toBe(state);
  });

  it("allows one occurrence to be snoozed without shifting its recurrence anchor", () => {
    let state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: {
        ...task("repeat", "inbox"),
        recurrence: {
          kind: "weekly",
          anchorDate: "2026-09-21",
        },
      },
    });

    state = dayDockReducer(state, {
      type: "task/deferred",
      taskId: "repeat",
      deferUntil: "2026-09-23",
      recurrence: {
        kind: "weekly",
        anchorDate: "2026-09-21",
      },
    });

    expect(state.tasks.repeat).toMatchObject({
      status: "later",
      deferUntil: "2026-09-23",
      recurrence: {
        kind: "weekly",
        anchorDate: "2026-09-21",
      },
    });
  });


  it("rejects a parked recurring task that has no return date", () => {
    const state = createInitialDayDockState();

    const unchanged = dayDockReducer(state, {
      type: "task/captured",
      task: {
        ...task("invalid-repeat", "later"),
        recurrence: {
          kind: "weekly",
          anchorDate: "2026-09-21",
        },
      },
    });

    expect(unchanged).toBe(state);
  });

  it("rejects a next occurrence that mutates the recurrence series", () => {
    const state = dayDockReducer(createInitialDayDockState(), {
      type: "task/captured",
      task: {
        ...task("series", "today"),
        recurrence: {
          kind: "weekly",
          anchorDate: "2026-09-21",
        },
      },
    });

    const unchanged = dayDockReducer(state, {
      type: "task/completedWithNext",
      taskId: "series",
      completedAt: "2026-09-21T10:00:00.000Z",
      nextTask: {
        ...task("series-next", "later"),
        deferUntil: "2026-09-22",
        recurrence: {
          kind: "daily",
          anchorDate: "2026-09-22",
        },
      },
    });

    expect(unchanged).toBe(state);
  });


  it("stores Ready again alert preference and deduplicates notification dates", () => {
    let state = createInitialDayDockState();

    state = dayDockReducer(state, {
      type: "notifications/readyAgainChanged",
      enabled: true,
    });

    expect(state.notifications.readyAgain).toBe(true);

    state = dayDockReducer(state, {
      type: "notifications/readyAgainNotified",
      dateKey: "2026-09-20",
    });

    expect(state.notifications.lastReadyAgainNotifiedDate).toBe("2026-09-20");

    const unchanged = dayDockReducer(state, {
      type: "notifications/readyAgainNotified",
      dateKey: "2026-09-20",
    });

    expect(unchanged).toBe(state);

    state = dayDockReducer(state, {
      type: "notifications/readyAgainChanged",
      enabled: false,
    });

    const disabled = dayDockReducer(state, {
      type: "notifications/readyAgainNotified",
      dateKey: "2026-09-21",
    });

    expect(disabled).toBe(state);
  });

});
