import type { CalendarBusyEvent } from "../daydock/model";

export interface CalendarFocusWindow {
  startAt: string;
  endAt: string;
  minutes: number;
}

export interface CalendarAwareness {
  timedEvents: CalendarBusyEvent[];
  allDayEvents: CalendarBusyEvent[];
  focusWindows: CalendarFocusWindow[];
  busyMinutes: number;
  availableMinutes: number;
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function timeOnLocalDay(date: Date, decimalHour: number): Date {
  const hour = Math.floor(decimalHour);
  const minute = Math.round((decimalHour - hour) * 60);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

export function buildCalendarAwareness(
  events: readonly CalendarBusyEvent[],
  now: Date,
  workdayStartHour = 8,
  workdayEndHour = 18,
): CalendarAwareness {
  const todayKey = localDateKey(now);
  const todayEvents = events.filter((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return (
      localDateKey(start) === todayKey ||
      localDateKey(new Date(end.getTime() - 1)) === todayKey ||
      (start < now &&
        end > new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
        ))
    );
  });

  const timedEvents = todayEvents
    .filter((event) => !event.allDay)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const allDayEvents = todayEvents
    .filter((event) => event.allDay)
    .sort((a, b) => a.title.localeCompare(b.title));

  const workdayStart = timeOnLocalDay(now, workdayStartHour);
  const workdayEnd = timeOnLocalDay(now, workdayEndHour);
  const effectiveStart = new Date(
    Math.max(workdayStart.getTime(), now.getTime()),
  );

  const merged: Array<{ start: number; end: number }> = [];

  for (const event of timedEvents) {
    const rawStart = Date.parse(event.startAt);
    const rawEnd = Date.parse(event.endAt);
    const start = clamp(
      rawStart - 5 * 60_000,
      effectiveStart.getTime(),
      workdayEnd.getTime(),
    );
    const end = clamp(
      rawEnd + 5 * 60_000,
      effectiveStart.getTime(),
      workdayEnd.getTime(),
    );

    if (end <= start) continue;

    const previous = merged.at(-1);
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      merged.push({ start, end });
    }
  }

  const focusWindows: CalendarFocusWindow[] = [];
  let cursor = effectiveStart.getTime();

  for (const busy of merged) {
    if (busy.start > cursor) {
      const minutes = Math.floor((busy.start - cursor) / 60_000);
      if (minutes >= 25) {
        focusWindows.push({
          startAt: new Date(cursor).toISOString(),
          endAt: new Date(busy.start).toISOString(),
          minutes,
        });
      }
    }
    cursor = Math.max(cursor, busy.end);
  }

  if (workdayEnd.getTime() > cursor) {
    const minutes = Math.floor((workdayEnd.getTime() - cursor) / 60_000);
    if (minutes >= 25) {
      focusWindows.push({
        startAt: new Date(cursor).toISOString(),
        endAt: workdayEnd.toISOString(),
        minutes,
      });
    }
  }

  const busyMinutes = merged.reduce(
    (total, busy) => total + Math.ceil((busy.end - busy.start) / 60_000),
    0,
  );
  const availableMinutes = focusWindows.reduce(
    (total, window) => total + window.minutes,
    0,
  );

  return {
    timedEvents,
    allDayEvents,
    focusWindows,
    busyMinutes,
    availableMinutes,
  };
}

export function suggestedFocusRoomMinutes(
  awareness: CalendarAwareness,
): number | null {
  if (awareness.timedEvents.length === 0 && awareness.allDayEvents.length === 0) {
    return null;
  }

  const available = awareness.availableMinutes;
  if (available <= 0) return 60;

  const capped = Math.min(300, Math.max(60, available));
  return Math.max(60, Math.floor(capped / 30) * 30);
}
