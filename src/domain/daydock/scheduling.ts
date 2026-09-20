import type { TaskRecurrence, TaskRecurrenceKind } from "./model";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string | null): boolean {
  if (value === null || !DATE_KEY_PATTERN.test(value)) return value === null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDateKey(value: string): Date {
  if (!isDateKey(value)) {
    throw new Error(`Invalid date key: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function toDateKey(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addCalendarDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function nextMonday(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const weekday = date.getUTCDay();
  const daysUntilMonday = weekday === 0 ? 1 : 8 - weekday;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return toDateKey(date);
}

function addMonthClamped(dateKey: string): string {
  const source = parseDateKey(dateKey);
  const sourceDay = source.getUTCDate();
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();

  const targetStart = new Date(Date.UTC(year, month + 1, 1));
  const targetLastDay = new Date(
    Date.UTC(targetStart.getUTCFullYear(), targetStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  targetStart.setUTCDate(Math.min(sourceDay, targetLastDay));
  return toDateKey(targetStart);
}

export function nextRecurrenceDate(
  kind: TaskRecurrenceKind,
  anchorDate: string,
): string {
  switch (kind) {
    case "daily":
      return addCalendarDays(anchorDate, 1);
    case "weekdays": {
      let next = addCalendarDays(anchorDate, 1);
      while ([0, 6].includes(parseDateKey(next).getUTCDay())) {
        next = addCalendarDays(next, 1);
      }
      return next;
    }
    case "weekly":
      return addCalendarDays(anchorDate, 7);
    case "monthly":
      return addMonthClamped(anchorDate);
  }
}

export function nextRecurrenceDateAfter(
  recurrence: TaskRecurrence,
  completedDate: string,
): string {
  let next = nextRecurrenceDate(recurrence.kind, recurrence.anchorDate);

  for (let iteration = 0; iteration < 5_000 && next <= completedDate; iteration += 1) {
    next = nextRecurrenceDate(recurrence.kind, next);
  }

  if (next <= completedDate) {
    throw new Error("Unable to advance recurring task beyond completion date.");
  }

  return next;
}

export function recurrenceLabel(kind: TaskRecurrenceKind): string {
  switch (kind) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
  }
}
