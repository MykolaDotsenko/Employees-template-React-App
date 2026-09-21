import { useRef, useState, type ChangeEvent } from "react";
import type {
  CalendarState,
  WorkdayPreferences,
} from "../../domain/daydock/model";
import type { CalendarAwareness } from "../../domain/calendar/availability";

interface CalendarContextPanelProps {
  calendar: CalendarState;
  awareness: CalendarAwareness;
  workday: WorkdayPreferences;
  onImport: (
    source: string,
    sourceLabel: string,
  ) => { eventCount: number; warnings: string[] };
  onClear: () => void;
  onWorkdayChange: (startHour: number, endHour: number) => void;
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

function formatHour(hour: number): string {
  if (hour === 24) return "24:00";

  const wholeHour = Math.floor(hour);
  const minute = Math.round((hour - wholeHour) * 60);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, wholeHour, minute, 0, 0));
}

const START_HOURS = Array.from({ length: 48 }, (_, index) => index / 2);
const END_HOURS = Array.from({ length: 48 }, (_, index) => (index + 1) / 2);

export function CalendarContextPanel({
  calendar,
  awareness,
  workday,
  onImport,
  onClear,
  onWorkdayChange,
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
  const nextFocusWindow = focusWindows[0] ?? null;

  const dayShapeSummary =
    nextFocusWindow === null
      ? "No 25+ minute focus window remains in the current workday."
      : `Next focus window ${formatWindow(nextFocusWindow.startAt, nextFocusWindow.endAt)} · ${nextFocusWindow.minutes} min`;

  return (
    <section
      className={hasCalendar ? "calendar-context is-compact" : "calendar-context"}
      aria-labelledby="calendar-context-title"
    >
      <div className="calendar-context-heading">
        <div>
          <p className="section-kicker">Calendar context</p>
          <h2 id="calendar-context-title">
            {hasCalendar
              ? `${meetingCount} timed ${meetingCount === 1 ? "event" : "events"} · ${awareness.availableMinutes}m focus room`
              : "Know what the day can hold"}
          </h2>
          <p>
            {hasCalendar
              ? dayShapeSummary
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
            onChange={(event) => {
              void importFile(event);
            }}
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
        <details className="calendar-context-details">
          <summary>View day shape</summary>

          <div className="calendar-context-details-body">
            <div className="calendar-workday-settings">
              <div>
                <p className="section-kicker">Working window</p>
                <strong>
                  {formatHour(workday.startHour)}–{formatHour(workday.endHour)}
                </strong>
                <span>
                  Focus room is calculated only inside this window. Change it
                  once and DayDock remembers it on this browser.
                </span>
              </div>

              <div className="calendar-workday-fields">
                <label>
                  <span>Starts</span>
                  <select
                    aria-label="Workday starts"
                    value={workday.startHour}
                    onChange={(event) => {
                      const startHour = Number(event.currentTarget.value);
                      onWorkdayChange(startHour, workday.endHour);
                    }}
                  >
                    {START_HOURS.filter((hour) => hour < workday.endHour).map(
                      (hour) => (
                        <option key={hour} value={hour}>
                          {formatHour(hour)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>Ends</span>
                  <select
                    aria-label="Workday ends"
                    value={workday.endHour}
                    onChange={(event) => {
                      const endHour = Number(event.currentTarget.value);
                      onWorkdayChange(workday.startHour, endHour);
                    }}
                  >
                    {END_HOURS.filter((hour) => hour > workday.startHour).map(
                      (hour) => (
                        <option key={hour} value={hour}>
                          {formatHour(hour)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>

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
                    No 25+ minute focus window remains inside the current
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
          </div>
        </details>
      ) : null}

      {message ? (
        <p className="calendar-import-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
