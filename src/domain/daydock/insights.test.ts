import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildReviewInsights,
  getRecordedFocusMs,
  timestampToDateKey,
} from "./insights";
import { createInitialDayDockState } from "./model";

describe("review insights", () => {
  it("converts timestamps to the requested calendar time zone", () => {
    expect(
      timestampToDateKey("2026-09-18T22:30:00.000Z", "Europe/Helsinki"),
    ).toBe("2026-09-19");

    expect(
      timestampToDateKey("2026-09-18T22:30:00.000Z", "UTC"),
    ).toBe("2026-09-18");
  });

  it("adds calendar days across month boundaries", () => {
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCalendarDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("calculates recorded focus time without paused duration", () => {
    expect(
      getRecordedFocusMs({
        id: "focus-a",
        taskId: "a",
        startedAt: "2026-09-19T10:00:00.000Z",
        durationMinutes: 50,
        pausedAt: null,
        accumulatedPauseMs: 5 * 60_000,
        endedAt: "2026-09-19T10:25:00.000Z",
        outcome: "completed",
      }),
    ).toBe(20 * 60_000);
  });

  it("builds a seven-day review from completed work and focus history", () => {
    const state = createInitialDayDockState();

    state.tasks.a = {
      id: "a",
      title: "Finish review",
      status: "done",
      estimateMinutes: 30,
      personId: null,
      createdAt: "2026-09-19T08:00:00.000Z",
      completedAt: "2026-09-19T10:00:00.000Z",
    };
    state.taskOrder.push("a");
    state.focus.history.push({
      id: "focus-a",
      taskId: "a",
      startedAt: "2026-09-19T09:30:00.000Z",
      durationMinutes: 30,
      pausedAt: null,
      accumulatedPauseMs: 0,
      endedAt: "2026-09-19T10:00:00.000Z",
      outcome: "completed",
    });

    const insights = buildReviewInsights(state, "2026-09-19", "UTC");

    expect(insights.week).toHaveLength(7);
    expect(insights.week[0]?.dateKey).toBe("2026-09-13");
    expect(insights.week.at(-1)).toEqual({
      dateKey: "2026-09-19",
      completedCount: 1,
      focusMinutes: 30,
    });
    expect(insights.completedToday.map((task) => task.id)).toEqual(["a"]);
    expect(insights.focusMinutesToday).toBe(30);
    expect(insights.focusSessionsToday.map((session) => session.id)).toEqual([
      "focus-a",
    ]);
  });

  it("keeps older completed work accessible in newest-first history", () => {
    const state = createInitialDayDockState();

    state.tasks.older = {
      id: "older",
      title: "Older completion",
      status: "done",
      estimateMinutes: null,
      personId: null,
      createdAt: "2026-09-10T08:00:00.000Z",
      completedAt: "2026-09-17T10:00:00.000Z",
    };
    state.tasks.newer = {
      id: "newer",
      title: "Newer completion",
      status: "done",
      estimateMinutes: null,
      personId: null,
      createdAt: "2026-09-10T08:00:00.000Z",
      completedAt: "2026-09-18T10:00:00.000Z",
    };
    state.taskOrder.push("older", "newer");

    const insights = buildReviewInsights(state, "2026-09-19", "UTC");

    expect(
      insights.completionHistory.map(({ task, dateKey }) => [task.id, dateKey]),
    ).toEqual([
      ["newer", "2026-09-18"],
      ["older", "2026-09-17"],
    ]);
  });

});
