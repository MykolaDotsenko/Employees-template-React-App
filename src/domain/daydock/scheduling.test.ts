import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  nextMonday,
  nextRecurrenceDate,
  nextRecurrenceDateAfter,
} from "./scheduling";

describe("DayDock scheduling", () => {
  it("computes tomorrow and the next Monday from calendar dates", () => {
    expect(addCalendarDays("2026-09-20", 1)).toBe("2026-09-21");
    expect(nextMonday("2026-09-20")).toBe("2026-09-21");
    expect(nextMonday("2026-09-21")).toBe("2026-09-28");
  });

  it("skips weekends for weekday recurrence", () => {
    expect(nextRecurrenceDate("weekdays", "2026-09-18")).toBe("2026-09-21");
    expect(nextRecurrenceDate("weekdays", "2026-09-21")).toBe("2026-09-22");
  });

  it("clamps monthly recurrence to the last valid day of the target month", () => {
    expect(nextRecurrenceDate("monthly", "2026-01-31")).toBe("2026-02-28");
    expect(nextRecurrenceDate("monthly", "2028-01-31")).toBe("2028-02-29");
  });

  it("catches a recurring task up beyond a late completion date", () => {
    expect(
      nextRecurrenceDateAfter(
        { kind: "daily", anchorDate: "2026-09-15" },
        "2026-09-20",
      ),
    ).toBe("2026-09-21");

    expect(
      nextRecurrenceDateAfter(
        { kind: "weekly", anchorDate: "2026-09-07" },
        "2026-09-20",
      ),
    ).toBe("2026-09-21");
  });
});
