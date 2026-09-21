import { describe, expect, it } from "vitest";
import type { CalendarBusyEvent } from "../daydock/model";
import {
  buildCalendarAwareness,
  suggestedFocusRoomMinutes,
} from "./availability";

function event(
  id: string,
  startAt: string,
  endAt: string,
): CalendarBusyEvent {
  return {
    id,
    title: id,
    startAt,
    endAt,
    allDay: false,
    source: "ics",
  };
}

describe("calendar availability", () => {
  it("merges meetings with breathing room and exposes useful focus windows", () => {
    const awareness = buildCalendarAwareness(
      [
        event("standup", "2026-09-20T09:00:00.000Z", "2026-09-20T09:30:00.000Z"),
        event("review", "2026-09-20T11:00:00.000Z", "2026-09-20T12:00:00.000Z"),
      ],
      new Date("2026-09-20T08:00:00.000Z"),
    );

    expect(awareness.timedEvents).toHaveLength(2);
    expect(awareness.focusWindows.map((window) => window.minutes)).toEqual([
      55,
      80,
      355,
    ]);
    expect(awareness.busyMinutes).toBe(110);
    expect(awareness.availableMinutes).toBe(490);
    expect(suggestedFocusRoomMinutes(awareness)).toBe(300);
  });

  it("calculates focus room inside a custom workday window", () => {
    const awareness = buildCalendarAwareness(
      [
        event("review", "2026-09-20T11:00:00.000Z", "2026-09-20T12:00:00.000Z"),
      ],
      new Date("2026-09-20T10:00:00.000Z"),
      10,
      16,
    );

    expect(awareness.focusWindows.map((window) => window.minutes)).toEqual([
      55,
      235,
    ]);
    expect(awareness.busyMinutes).toBe(70);
    expect(awareness.availableMinutes).toBe(290);
  });

  it("does not count all-day context as blocked focus time", () => {
    const allDay: CalendarBusyEvent = {
      id: "holiday",
      title: "Company day",
      startAt: "2026-09-20T00:00:00.000Z",
      endAt: "2026-09-21T00:00:00.000Z",
      allDay: true,
      source: "ics",
    };

    const awareness = buildCalendarAwareness(
      [allDay],
      new Date("2026-09-20T08:00:00.000Z"),
    );

    expect(awareness.allDayEvents).toHaveLength(1);
    expect(awareness.busyMinutes).toBe(0);
    expect(awareness.availableMinutes).toBe(600);
    expect(suggestedFocusRoomMinutes(awareness)).toBe(300);
  });
});
