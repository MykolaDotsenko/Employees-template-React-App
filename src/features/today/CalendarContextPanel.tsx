import { useRef, useState, type ChangeEvent } from "react";
import type { CalendarState } from "../../domain/daydock/model";
import type { CalendarAwareness } from "../../domain/calendar/availability";

interface CalendarContextPanelProps {
  calendar: CalendarState;
  awareness: CalendarAwareness;
  onImport: (
    source: string,
    sourceLabel: string,
  ) => { eventCount: number; warnings: string[] };
  onClear: () => void;
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatWindow(startAt: string, endAt: string): string {
  return `${formatClock(startAt)}–${formatClock(endAt)}`;
}

function formatImportedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CalendarContextPanel({
  calendar,
  awareness,
  onImport,
  onClear,
}: CalendarContextPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (
      file.size > 5 * 1024 * 1024 ||
      (!file.name.toLowerCase().endsWith(".ics") &&
        file.type !== "text/calendar")
    ) {
      setMessage("Choose an .ics calendar file up to 5 MB.");
      return;
    }

    try {
      const source = await file.text();
      const result = onImport(source, file.name);
      setMessage(
        result.warnings.length > 0
          ? `Imported ${result.eventCount} busy events · ${result.warnings[0]}`
          : `Imported ${result.eventCount} busy events locally.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "DayDock could not read this calendar file.",
      );
    }
  }

  const hasCalendar = calendar.importedAt !== null;
  const meetingCount = awareness.timedEvents.length;
  const nextMeetings = awareness.timedEvents.slice(0, 4);
  const focusWindows = awareness.focusWindows.slice(0, 3);

  return (
    <section className="calendar-context" aria-labelledby="calendar-context-title">
      <div className="calendar-context-heading">
        <div>
          <p className="section-kicker">Calendar awareness</p>
          <h2 id="calendar-context-title">
            {hasCalendar ? "Room around the meetings" : "Know what the day can hold"}
          </h2>
          <p>
            {hasCalendar
              ? "DayDock treats calendar events as constraints, not another task list."
              : "Import a read-only .ics file. It stays in this workspace and is used only to reveal realistic focus room."}
          </p>
        </div>

        <div className="calendar-context-actions">
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".ics,text/calendar"
            aria-label="Import calendar file"
            onChange={importFile}
          />
          <button
            type="button"
            className="calendar-import-button"
            onClick={() => inputRef.current?.click()}
          >
            {hasCalendar ? "Refresh .ics" : "Import .ics"}
          </button>
          {hasCalendar ? (
            <button
              type="button"
              className="calendar-clear-button"
              onClick={() => {
                onClear();
                setMessage("Calendar context cleared from this browser.");
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {hasCalendar ? (
        <>
          <div className="calendar-context-metrics">
            <div>
              <strong>{meetingCount}</strong>
              <span>timed {meetingCount === 1 ? "event" : "events"} today</span>
            </div>
            <div>
              <strong>{Math.round(awareness.busyMinutes / 5) * 5}m</strong>
              <span>busy + breathing room</span>
            </div>
            <div>
              <strong>{awareness.availableMinutes}m</strong>
              <span>open focus windows</span>
            </div>
          </div>

          <div className="calendar-context-grid">
            <div>
              <p className="section-kicker">Today’s constraints</p>
              {nextMeetings.length > 0 ? (
                <ol className="calendar-event-list">
                  {nextMeetings.map((event) => (
                    <li key={event.id}>
                      <span>{formatWindow(event.startAt, event.endAt)}</span>
                      <strong>{event.title}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="calendar-empty-copy">
                  No timed events in the imported calendar today.
                </p>
              )}
              {awareness.allDayEvents.length > 0 ? (
                <p className="calendar-all-day-note">
                  {awareness.allDayEvents.length} all-day{" "}
                  {awareness.allDayEvents.length === 1 ? "item" : "items"} shown
                  for context but not counted as busy time.
                </p>
              ) : null}
            </div>

            <div>
              <p className="section-kicker">Focus windows</p>
              {focusWindows.length > 0 ? (
                <ol className="focus-window-list">
                  {focusWindows.map((window) => (
                    <li key={window.startAt}>
                      <strong>{formatWindow(window.startAt, window.endAt)}</strong>
                      <span>{window.minutes} min available</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="calendar-empty-copy">
                  No 25+ minute focus window remains inside the 08:00–18:00
                  workday.
                </p>
              )}
            </div>
          </div>

          <p className="calendar-source-note">
            {calendar.sourceLabel} · imported{" "}
            {formatImportedAt(calendar.importedAt ?? "")} · local snapshot,
            refresh manually when your calendar changes.
          </p>
        </>
      ) : null}

      {message ? (
        <p className="calendar-import-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
