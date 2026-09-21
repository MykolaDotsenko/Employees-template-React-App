import { useState } from "react";
import type { DayPlan } from "../../domain/daydock/model";

interface StartDayPanelProps {
  todayKey: string;
  existingPlan: DayPlan | null;
  readyAgainCount: number;
  inboxCount: number;
  duePeopleCount: number;
  top3Count: number;
  suggestedFocusRoomMinutes?: number | null;
  onOpenInbox: () => void;
  onOpenPeople: () => void;
  onStartDay: (focusRoomMinutes: number) => void;
}

const FOCUS_ROOM_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300] as const;

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function StartDayPanel({
  todayKey,
  existingPlan,
  readyAgainCount,
  inboxCount,
  duePeopleCount,
  top3Count,
  suggestedFocusRoomMinutes = null,
  onOpenInbox,
  onOpenPeople,
  onStartDay,
}: StartDayPanelProps) {
  const alreadyStarted = existingPlan?.dateKey === todayKey;
  const [manualFocusRoomMinutes, setManualFocusRoomMinutes] = useState<
    number | null
  >(null);
  const focusRoomMinutes =
    existingPlan?.focusRoomMinutes ??
    manualFocusRoomMinutes ??
    suggestedFocusRoomMinutes ??
    150;
  const focusRoomOptions = Array.from(
    new Set([
      ...FOCUS_ROOM_OPTIONS,
      ...(suggestedFocusRoomMinutes === null
        ? []
        : [suggestedFocusRoomMinutes]),
    ]),
  ).sort((left, right) => left - right);

  if (alreadyStarted) {
    return (
      <section className="day-plan-summary" aria-label="Today plan">
        <span className="day-plan-summary-mark" aria-hidden="true">✓</span>
        <div>
          <strong>Day started</strong>
          <span>{formatMinutes(existingPlan.focusRoomMinutes)} of focus room</span>
        </div>
      </section>
    );
  }

  return (
    <section className="start-day-panel" aria-labelledby="start-day-title">
      <div className="start-day-heading">
        <div>
          <p className="section-kicker">60-second reset</p>
          <h2 id="start-day-title">Give today a shape</h2>
          <p>
            See what came back, notice who needs attention, then protect a
            realistic amount of focus time.
          </p>
        </div>
        <span className="start-day-sun" aria-hidden="true">☼</span>
      </div>

      <div className="start-day-signals">
        <button type="button" onClick={onOpenInbox}>
          <span>
            <strong>{readyAgainCount}</strong>
            <small>ready again</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={onOpenPeople}>
          <span>
            <strong>{duePeopleCount}</strong>
            <small>people due</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <div>
          <span>
            <strong>{top3Count} / 3</strong>
            <small>priorities chosen</small>
          </span>
          <span className="start-day-signal-note">
            {inboxCount > readyAgainCount
              ? `${inboxCount - readyAgainCount} new in Inbox`
              : "Inbox has no new captures"}
          </span>
        </div>
      </div>

      <div className="start-day-footer">
        <label className="start-day-focus-room">
          <span>Focus room</span>
          <select
            aria-label="Available focus room"
            value={focusRoomMinutes}
            onChange={(event) => {
              setManualFocusRoomMinutes(Number(event.currentTarget.value));
            }}
          >
            {focusRoomOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatMinutes(minutes)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="start-day-action"
          onClick={() => onStartDay(focusRoomMinutes)}
        >
          Start my day
          <span className="start-day-action-time">
            {formatMinutes(focusRoomMinutes)}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="start-day-note">
        This is a planning estimate, not a target. DayDock never scores the day.
      </p>
    </section>
  );
}
