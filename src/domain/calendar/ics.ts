import type { CalendarBusyEvent } from "../daydock/model";

interface CalendarImportOptions {
  now?: Date;
  horizonDays?: number;
}

interface ParsedProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface ParsedTemporal {
  date: Date;
  allDay: boolean;
  timeZone: string | null;
  isUtc: boolean;
  wall: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

interface RawEvent {
  uid: string;
  title: string;
  start: ParsedTemporal;
  end: ParsedTemporal | null;
  durationMs: number | null;
  transparent: boolean;
  cancelled: boolean;
  rrule: string | null;
  exdates: ParsedTemporal[];
  recurrenceId: ParsedTemporal | null;
}

export interface CalendarImportResult {
  events: CalendarBusyEvent[];
  warnings: string[];
}

const WEEKDAY = new Map([
  ["SU", 0],
  ["MO", 1],
  ["TU", 2],
  ["WE", 3],
  ["TH", 4],
  ["FR", 5],
  ["SA", 6],
]);

function unfoldLines(source: string): string[] {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseProperty(line: string): ParsedProperty | null {
  const separator = line.indexOf(":");
  if (separator <= 0) return null;

  const head = line.slice(0, separator).split(";");
  const name = head[0]?.trim().toUpperCase();
  if (!name) return null;

  const params: Record<string, string> = {};

  for (const part of head.slice(1)) {
    const equals = part.indexOf("=");
    if (equals <= 0) continue;
    params[part.slice(0, equals).toUpperCase()] = part
      .slice(equals + 1)
      .replace(/^"|"$/g, "");
  }

  return {
    name,
    params,
    value: line.slice(separator + 1),
  };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function wallTimeAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function wallToUtc(
  wall: ParsedTemporal["wall"],
  timeZone: string,
): Date {
  let instant = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallTimeAt(new Date(instant), timeZone);
    const desiredWall = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    );
    const actualWall = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = desiredWall - actualWall;
    if (correction === 0) break;
    instant += correction;
  }

  return new Date(instant);
}

function parseTemporal(
  value: string,
  params: Record<string, string>,
): ParsedTemporal | null {
  const isDate =
    params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/,
  );
  if (!match) return null;

  const wall = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
  const isUtc = match[7] === "Z";
  const timeZone = params.TZID ?? null;

  let date: Date;

  try {
    if (isDate || isUtc) {
      date = new Date(
        Date.UTC(
          wall.year,
          wall.month - 1,
          wall.day,
          wall.hour,
          wall.minute,
          wall.second,
        ),
      );
    } else if (timeZone) {
      date = wallToUtc(wall, timeZone);
    } else {
      date = new Date(
        wall.year,
        wall.month - 1,
        wall.day,
        wall.hour,
        wall.minute,
        wall.second,
      );
    }
  } catch {
    return null;
  }

  return Number.isNaN(date.getTime())
    ? null
    : { date, allDay: isDate, timeZone, isUtc, wall };
}

function parseDuration(value: string): number | null {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const totalMs =
    (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1_000;

  return totalMs > 0 ? totalMs : null;
}

function parseRawEvent(properties: ParsedProperty[]): RawEvent | null {
  const first = (name: string) =>
    properties.find((property) => property.name === name);
  const all = (name: string) =>
    properties.filter((property) => property.name === name);

  const uid = first("UID")?.value.trim();
  const startProperty = first("DTSTART");
  if (!uid || !startProperty) return null;

  const start = parseTemporal(startProperty.value, startProperty.params);
  if (!start) return null;

  const endProperty = first("DTEND");
  const end = endProperty
    ? parseTemporal(endProperty.value, endProperty.params)
    : null;

  const recurrenceProperty = first("RECURRENCE-ID");
  const recurrenceId = recurrenceProperty
    ? parseTemporal(recurrenceProperty.value, recurrenceProperty.params)
    : null;

  return {
    uid,
    title: unescapeText(first("SUMMARY")?.value || "Busy"),
    start,
    end,
    durationMs: first("DURATION")
      ? parseDuration(first("DURATION")?.value ?? "")
      : null,
    transparent: first("TRANSP")?.value.toUpperCase() === "TRANSPARENT",
    cancelled: first("STATUS")?.value.toUpperCase() === "CANCELLED",
    rrule: first("RRULE")?.value ?? null,
    exdates: all("EXDATE").flatMap((property) =>
      property.value
        .split(",")
        .map((value) => parseTemporal(value, property.params))
        .filter((value): value is ParsedTemporal => value !== null),
    ),
    recurrenceId,
  };
}

function parseRule(value: string) {
  return Object.fromEntries(
    value.split(";").flatMap((part) => {
      const equals = part.indexOf("=");
      if (equals <= 0) return [];
      return [[part.slice(0, equals).toUpperCase(), part.slice(equals + 1)]];
    }),
  );
}

function dayNumber(wall: ParsedTemporal["wall"]): number {
  return Math.floor(
    Date.UTC(wall.year, wall.month - 1, wall.day) / 86_400_000,
  );
}

function monthNumber(wall: ParsedTemporal["wall"]): number {
  return wall.year * 12 + wall.month - 1;
}

function wallFromSerialDay(
  serial: number,
  time: Pick<ParsedTemporal["wall"], "hour" | "minute" | "second">,
): ParsedTemporal["wall"] {
  const date = new Date(serial * 86_400_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    ...time,
  };
}

function occurrenceDate(
  temporal: ParsedTemporal,
  wall: ParsedTemporal["wall"],
): Date {
  if (temporal.allDay || temporal.isUtc) {
    return new Date(
      Date.UTC(
        wall.year,
        wall.month - 1,
        wall.day,
        wall.hour,
        wall.minute,
        wall.second,
      ),
    );
  }

  if (temporal.timeZone) {
    return wallToUtc(wall, temporal.timeZone);
  }

  return new Date(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
}

function dateKey(date: Date): string {
  return String(Math.floor(date.getTime() / 60_000));
}

function overlaps(start: Date, end: Date, windowStart: Date, windowEnd: Date) {
  return end > windowStart && start < windowEnd;
}

function expandEvent(
  event: RawEvent,
  windowStart: Date,
  windowEnd: Date,
  suppressed: Set<string>,
  warnings: string[],
): CalendarBusyEvent[] {
  if (event.cancelled || event.transparent) return [];

  const durationMs =
    event.end !== null
      ? Math.max(1, event.end.date.getTime() - event.start.date.getTime())
      : event.durationMs ??
        (event.start.allDay ? 86_400_000 : 60 * 60_000);

  const makeBusyEvent = (start: Date, occurrenceId: string) => ({
    id: `${event.uid}:${occurrenceId}`,
    title: event.title || "Busy",
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + durationMs).toISOString(),
    allDay: event.start.allDay,
    source: "ics" as const,
  });

  if (event.recurrenceId !== null || event.rrule === null) {
    const end = new Date(event.start.date.getTime() + durationMs);
    return overlaps(event.start.date, end, windowStart, windowEnd)
      ? [makeBusyEvent(event.start.date, dateKey(event.start.date))]
      : [];
  }

  const rule = parseRule(event.rrule);
  const frequency = rule.FREQ?.toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(frequency ?? "")) {
    warnings.push(`Unsupported recurrence frequency on “${event.title}”.`);
    return [];
  }

  const interval = Math.max(1, Number(rule.INTERVAL ?? 1) || 1);
  const countLimit = Math.max(0, Number(rule.COUNT ?? 0) || 0);
  const until = rule.UNTIL
    ? parseTemporal(rule.UNTIL, {
        ...(event.start.timeZone ? { TZID: event.start.timeZone } : {}),
      })?.date ?? null
    : null;
  const byDays = (rule.BYDAY ?? "")
    .split(",")
    .map((value) => value.slice(-2).toUpperCase())
    .flatMap((value) => {
      const weekday = WEEKDAY.get(value);
      return weekday === undefined ? [] : [weekday];
    });
  const byMonthDays = (rule.BYMONTHDAY ?? "")
    .split(",")
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);

  if (frequency === "MONTHLY" && rule.BYDAY) {
    warnings.push(
      `Monthly BYDAY on “${event.title}” is outside DayDock’s local import subset.`,
    );
  }

  const baseSerial = dayNumber(event.start.wall);
  const windowSerial = Math.floor(windowStart.getTime() / 86_400_000);
  const lastSerial = Math.floor(windowEnd.getTime() / 86_400_000) + 1;
  const firstSerial = Math.max(baseSerial, windowSerial - 370);
  const exdates = new Set(event.exdates.map((item) => dateKey(item.date)));
  const results: CalendarBusyEvent[] = [];
  let occurrenceCount = 0;
  let iterations = 0;

  for (
    let serial = baseSerial;
    serial <= lastSerial && iterations < 20_000;
    serial += 1, iterations += 1
  ) {
    const wall = wallFromSerialDay(serial, {
      hour: event.start.wall.hour,
      minute: event.start.wall.minute,
      second: event.start.wall.second,
    });
    const diffDays = serial - baseSerial;
    const months = monthNumber(wall) - monthNumber(event.start.wall);
    const weekday = new Date(
      Date.UTC(wall.year, wall.month - 1, wall.day),
    ).getUTCDay();

    let matches = false;

    if (frequency === "DAILY") {
      matches = diffDays % interval === 0;
    } else if (frequency === "WEEKLY") {
      const week = Math.floor(diffDays / 7);
      const expectedDays =
        byDays.length > 0
          ? byDays
          : [
              new Date(
                Date.UTC(
                  event.start.wall.year,
                  event.start.wall.month - 1,
                  event.start.wall.day,
                ),
              ).getUTCDay(),
            ];
      matches = week % interval === 0 && expectedDays.includes(weekday);
    } else if (frequency === "MONTHLY") {
      const targetDays =
        byMonthDays.length > 0 ? byMonthDays : [event.start.wall.day];
      matches =
        months >= 0 &&
        months % interval === 0 &&
        targetDays.includes(wall.day);
    } else if (frequency === "YEARLY") {
      const years = wall.year - event.start.wall.year;
      matches =
        years >= 0 &&
        years % interval === 0 &&
        wall.month === event.start.wall.month &&
        wall.day === event.start.wall.day;
    }

    if (!matches) continue;

    const start = occurrenceDate(event.start, wall);
    if (start < event.start.date) continue;
    if (until !== null && start > until) break;

    occurrenceCount += 1;
    if (countLimit > 0 && occurrenceCount > countLimit) break;

    const key = dateKey(start);
    if (exdates.has(key) || suppressed.has(key)) continue;
    if (serial < firstSerial) continue;

    const end = new Date(start.getTime() + durationMs);
    if (!overlaps(start, end, windowStart, windowEnd)) continue;

    results.push(makeBusyEvent(start, key));
    if (results.length >= 1_500) break;
  }

  return results;
}

export function parseIcsCalendar(
  source: string,
  options: CalendarImportOptions = {},
): CalendarImportResult {
  const now = options.now ?? new Date();
  const horizonDays = Math.min(90, Math.max(7, options.horizonDays ?? 45));
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - 1);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + horizonDays + 2);

  const rawEvents: RawEvent[] = [];
  let current: ParsedProperty[] | null = null;

  for (const line of unfoldLines(source)) {
    if (line.trim().toUpperCase() === "BEGIN:VEVENT") {
      current = [];
      continue;
    }

    if (line.trim().toUpperCase() === "END:VEVENT") {
      if (current !== null) {
        const parsed = parseRawEvent(current);
        if (parsed) rawEvents.push(parsed);
      }
      current = null;
      continue;
    }

    if (current !== null) {
      const property = parseProperty(line);
      if (property) current.push(property);
    }
  }

  if (rawEvents.length === 0) {
    throw new Error("No readable VEVENT entries were found in this calendar.");
  }

  const suppressions = new Map<string, Set<string>>();

  for (const event of rawEvents) {
    if (event.recurrenceId === null) continue;
    const set = suppressions.get(event.uid) ?? new Set<string>();
    set.add(dateKey(event.recurrenceId.date));
    suppressions.set(event.uid, set);
  }

  const warnings: string[] = [];
  const events = rawEvents
    .flatMap((event) =>
      expandEvent(
        event,
        windowStart,
        windowEnd,
        suppressions.get(event.uid) ?? new Set(),
        warnings,
      ),
    )
    .sort(
      (left, right) =>
        Date.parse(left.startAt) - Date.parse(right.startAt) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, 1_500);

  return {
    events,
    warnings: [...new Set(warnings)].slice(0, 8),
  };
}
