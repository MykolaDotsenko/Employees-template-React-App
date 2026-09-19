import type {
  DayDockState,
  FocusSessionRecord,
  Task,
} from "./model";

export interface DayInsight {
  dateKey: string;
  completedCount: number;
  focusMinutes: number;
}

export interface ReviewInsights {
  completedToday: Task[];
  focusMinutesToday: number;
  week: DayInsight[];
}

function dateKeyFromParts(parts: Intl.DateTimeFormatPart[]): string {
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error("Unable to derive a calendar date.");
  }

  return `${year}-${month}-${day}`;
}

export function timestampToDateKey(
  timestamp: string,
  timeZone: string,
): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp.");
  }

  return dateKeyFromParts(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date),
  );
}

export function addCalendarDays(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid date key.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid date key.");
  }

  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getRecordedFocusMs(session: FocusSessionRecord): number {
  const startedAt = Date.parse(session.startedAt);
  const endedAt = Date.parse(session.endedAt);

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;

  return Math.max(0, endedAt - startedAt - session.accumulatedPauseMs);
}

export function buildReviewInsights(
  state: DayDockState,
  todayKey: string,
  timeZone: string,
): ReviewInsights {
  const week = Array.from({ length: 7 }, (_, index) => ({
    dateKey: addCalendarDays(todayKey, index - 6),
    completedCount: 0,
    focusMinutes: 0,
  }));

  const byDate = new Map(week.map((day) => [day.dateKey, day]));
  const completedToday: Task[] = [];

  for (const taskId of state.taskOrder) {
    const task = state.tasks[taskId];

    if (!task || task.status !== "done" || task.completedAt === null) continue;

    const dateKey = timestampToDateKey(task.completedAt, timeZone);
    const bucket = byDate.get(dateKey);

    if (bucket) bucket.completedCount += 1;
    if (dateKey === todayKey) completedToday.push(task);
  }

  for (const session of state.focus.history) {
    const dateKey = timestampToDateKey(session.endedAt, timeZone);
    const bucket = byDate.get(dateKey);
    if (!bucket) continue;

    bucket.focusMinutes += Math.round(getRecordedFocusMs(session) / 60_000);
  }

  return {
    completedToday,
    focusMinutesToday:
      byDate.get(todayKey)?.focusMinutes ?? 0,
    week,
  };
}
