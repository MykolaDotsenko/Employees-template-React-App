import { describe, expect, it } from "vitest";
import {
  formatFocusClock,
  getFocusElapsedMs,
  getFocusProgress,
  getFocusRemainingMs,
} from "./focus";
import type { ActiveFocusSession } from "./model";

function session(
  overrides: Partial<ActiveFocusSession> = {},
): ActiveFocusSession {
  return {
    id: "focus-a",
    taskId: "task-a",
    startedAt: "2026-09-19T10:00:00.000Z",
    durationMinutes: 50,
    pausedAt: null,
    accumulatedPauseMs: 0,
    ...overrides,
  };
}

describe("focus timing", () => {
  it("derives remaining time from timestamps instead of tick count", () => {
    const active = session();
    const now = Date.parse("2026-09-19T10:17:30.000Z");

    expect(getFocusElapsedMs(active, now)).toBe(17.5 * 60_000);
    expect(getFocusRemainingMs(active, now)).toBe(32.5 * 60_000);
  });

  it("freezes elapsed time while paused", () => {
    const active = session({
      pausedAt: "2026-09-19T10:10:00.000Z",
    });

    expect(
      getFocusElapsedMs(active, Date.parse("2026-09-19T10:30:00.000Z")),
    ).toBe(10 * 60_000);
  });

  it("subtracts accumulated pause time after resume", () => {
    const active = session({
      accumulatedPauseMs: 5 * 60_000,
    });

    expect(
      getFocusElapsedMs(active, Date.parse("2026-09-19T10:20:00.000Z")),
    ).toBe(15 * 60_000);
  });

  it("caps progress and clock output at completion", () => {
    const active = session();
    const now = Date.parse("2026-09-19T11:30:00.000Z");

    expect(getFocusProgress(active, now)).toBe(1);
    expect(getFocusRemainingMs(active, now)).toBe(0);
    expect(formatFocusClock(0)).toBe("00:00");
  });
});
