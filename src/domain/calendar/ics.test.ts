import { describe, expect, it } from "vitest";
import { parseIcsCalendar } from "./ics";

describe("ICS calendar import", () => {
  it("imports timed, all-day and recurring busy events while respecting EXDATE", () => {
    const source = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:standup",
      "SUMMARY:Daily standup",
      "DTSTART:20260921T090000Z",
      "DTEND:20260921T093000Z",
      "RRULE:FREQ=DAILY;COUNT=4",
      "EXDATE:20260923T090000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:transparent",
      "SUMMARY:FYI only",
      "DTSTART:20260921T100000Z",
      "DTEND:20260921T110000Z",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:holiday",
      "SUMMARY:Company day",
      "DTSTART;VALUE=DATE:20260922",
      "DTEND;VALUE=DATE:20260923",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseIcsCalendar(source, {
      now: new Date("2026-09-20T08:00:00.000Z"),
      horizonDays: 7,
    });

    expect(result.events.map((event) => event.title)).toEqual([
      "Daily standup",
      "Company day",
      "Daily standup",
      "Daily standup",
    ]);
    expect(
      result.events.some((event) => event.startAt.startsWith("2026-09-23T09:00")),
    ).toBe(false);
    expect(result.events.find((event) => event.title === "Company day")?.allDay)
      .toBe(true);
    expect(result.events.some((event) => event.title === "FYI only")).toBe(false);
  });

  it("expands common weekly BYDAY recurrence", () => {
    const source = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:planning",
      "SUMMARY:Planning",
      "DTSTART:20260921T130000Z",
      "DTEND:20260921T140000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const result = parseIcsCalendar(source, {
      now: new Date("2026-09-20T08:00:00.000Z"),
      horizonDays: 14,
    });

    expect(result.events.map((event) => event.startAt.slice(0, 10))).toEqual([
      "2026-09-21",
      "2026-09-23",
      "2026-09-28",
      "2026-09-30",
    ]);
  });

  it("rejects files without readable events", () => {
    expect(() =>
      parseIcsCalendar("BEGIN:VCALENDAR\nEND:VCALENDAR", {
        now: new Date("2026-09-20T08:00:00.000Z"),
      }),
    ).toThrow(/No readable VEVENT/);
  });
});
