import { ViewTransition, useState } from "react";
import { normalizeFocusDurationMinutes } from "../../domain/daydock/focus";
import type {
  CalendarState,
  DayPlan,
  Task,
} from "../../domain/daydock/model";
import type { CalendarAwareness } from "../../domain/calendar/availability";
import { TaskRow } from "../tasks/TaskRow";
import { CalendarContextPanel } from "./CalendarContextPanel";
import { StartDayPanel } from "./StartDayPanel";

export type GettingStartedStage = "capture" | "decide" | null;

interface TodaySurfaceProps {
  top3: Task[];
  todayTasks: Task[];
  gettingStartedStage: GettingStartedStage;
  todayKey: string;
  dayPlan: DayPlan | null;
  readyAgainCount: number;
  inboxCount: number;
  duePeopleCount: number;
  calendar: CalendarState;
  calendarAwareness: CalendarAwareness;
  suggestedFocusRoomMinutes: number | null;
  onImportCalendar: (
    source: string,
    sourceLabel: string,
  ) => { eventCount: number; warnings: string[] };
  onClearCalendar: () => void;
  onCapture: () => void;
  onOpenInbox: () => void;
  onOpenPeople: () => void;
  onStartDay: (focusRoomMinutes: number) => void;
  onAddToTop3: (taskId: string) => void;
  onRemoveFromTop3: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onRemove: (taskId: string) => void;
  onStartFocus: (taskId: string, durationMinutes: number) => void;
}

export function TodaySurface({
  top3,
  todayTasks,
  gettingStartedStage,
  todayKey,
  dayPlan,
  readyAgainCount,
  inboxCount,
  duePeopleCount,
  calendar,
  calendarAwareness,
  suggestedFocusRoomMinutes,
  onImportCalendar,
  onClearCalendar,
  onCapture,
  onOpenInbox,
  onOpenPeople,
  onStartDay,
  onAddToTop3,
  onRemoveFromTop3,
  onComplete,
  onRename,
  onRemove,
  onStartFocus,
}: TodaySurfaceProps) {
  const top3Ids = new Set(top3.map((task) => task.id));
  const remaining = todayTasks.filter((task) => !top3Ids.has(task.id));
  const currentTask = top3[0] ?? null;
  const [focusDurations, setFocusDurations] = useState<Record<string, number>>({});
  const defaultFocusDuration =
    currentTask === null
      ? 50
      : normalizeFocusDurationMinutes(currentTask.estimateMinutes);
  const focusDuration =
    currentTask === null
      ? defaultFocusDuration
      : (focusDurations[currentTask.id] ?? defaultFocusDuration);
  const focusOptions = Array.from(
    new Set([25, 50, 90, defaultFocusDuration]),
  ).sort((left, right) => left - right);

  return (
    <div className="surface-stack">
      <section className="intro-block" aria-labelledby="today-title">
        <p className="eyebrow">A clear start</p>
        <h1 id="today-title">Today</h1>
        <p className="intro-copy">
          Keep the day small. Choose up to three outcomes worth finishing.
        </p>
      </section>

      {gettingStartedStage === null ? (
        <StartDayPanel
          todayKey={todayKey}
          existingPlan={dayPlan}
          readyAgainCount={readyAgainCount}
          inboxCount={inboxCount}
          duePeopleCount={duePeopleCount}
          top3Count={top3.length}
          suggestedFocusRoomMinutes={suggestedFocusRoomMinutes}
          onOpenInbox={onOpenInbox}
          onOpenPeople={onOpenPeople}
          onStartDay={onStartDay}
        />
      ) : null}

      {gettingStartedStage === null ? (
        <section className="now-card" aria-labelledby="now-title">
          <div>
            <p className="section-kicker">Now</p>
            {currentTask ? (
              <ViewTransition name={`focus-task-${currentTask.id}`}>
                <h2 id="now-title">{currentTask.title}</h2>
              </ViewTransition>
            ) : (
              <h2 id="now-title">One thing at a time</h2>
            )}
            <p>
              {currentTask
                ? "Your first priority is ready. Give it a protected block of attention."
                : "Choose a Top 3 priority and DayDock will make the next action obvious."}
            </p>
            {currentTask ? (
              <div className="focus-launch-controls">
                <label className="focus-duration-field">
                  <span>Focus block</span>
                  <select
                    aria-label="Focus duration"
                    value={focusDuration}
                    onChange={(event) => {
                      const nextDuration = Number(event.currentTarget.value);
                      setFocusDurations((current) => ({
                        ...current,
                        [currentTask.id]: nextDuration,
                      }));
                    }}
                  >
                    {focusOptions.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="start-focus-button"
                  onClick={() => onStartFocus(currentTask.id, focusDuration)}
                >
                  Start focus
                  <span aria-hidden="true">{focusDuration} min</span>
                </button>
              </div>
            ) : null}
          </div>
          <span className="now-orbit" aria-hidden="true" />
        </section>
      ) : null}

      {gettingStartedStage ? (
        <section className="first-run-guide" aria-labelledby="first-run-title">
          <div className="first-run-copy">
            <p className="section-kicker">Start here</p>
            <h2 id="first-run-title">
              {gettingStartedStage === "capture"
                ? "A fresh day"
                : "Your first item is safe"}
            </h2>
            <p>
              {gettingStartedStage === "capture"
                ? "DayDock becomes useful in three small moves. Start by getting one real commitment out of your head."
                : "Now decide whether it deserves today, belongs later, or is already done. DayDock keeps that decision separate from capture."}
            </p>

            <button
              type="button"
              className="first-run-action"
              onClick={
                gettingStartedStage === "capture" ? onCapture : onOpenInbox
              }
            >
              {gettingStartedStage === "capture"
                ? "Capture your first item"
                : "Open Inbox"}
              <span aria-hidden="true">→</span>
            </button>

            <small>No account · stored locally in this browser</small>
          </div>

          <ol className="first-run-steps" aria-label="DayDock getting started">
            <li
              className={
                gettingStartedStage === "capture"
                  ? "first-run-step is-current"
                  : "first-run-step is-complete"
              }
            >
              <span className="first-run-step-number" aria-hidden="true">
                {gettingStartedStage === "decide" ? "✓" : "1"}
              </span>
              <div>
                <strong>Capture</strong>
                <p>Get it out of your head without organizing it first.</p>
              </div>
            </li>
            <li
              className={
                gettingStartedStage === "decide"
                  ? "first-run-step is-current"
                  : "first-run-step"
              }
            >
              <span className="first-run-step-number" aria-hidden="true">2</span>
              <div>
                <strong>Decide</strong>
                <p>Choose Today, Later, or Done when you have attention.</p>
              </div>
            </li>
            <li className="first-run-step">
              <span className="first-run-step-number" aria-hidden="true">3</span>
              <div>
                <strong>Focus</strong>
                <p>Protect up to three outcomes and work on one at a time.</p>
              </div>
            </li>
          </ol>
        </section>
      ) : (
        <section className="section-block" aria-labelledby="priorities-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Top 3</p>
              <h2 id="priorities-title">What matters today</h2>
            </div>
            <span className="count-pill">{top3.length} / 3</span>
          </div>

          {top3.length > 0 ? (
            <ol className="task-list priority-task-list">
              {top3.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRename={onRename}
                  onRemove={onRemove}
                  leading={<span className="priority-index">{index + 1}</span>}
                  actions={
                    <>
                      <button
                        type="button"
                        className="text-action"
                        aria-label={`Remove ${task.title} from Top 3`}
                        onClick={() => onRemoveFromTop3(task.id)}
                      >
                        Unpin
                      </button>
                      <button
                        type="button"
                        className="text-action positive-action"
                        aria-label={`Complete ${task.title}`}
                        onClick={() => onComplete(task.id)}
                      >
                        Done
                      </button>
                    </>
                  }
                />
              ))}
            </ol>
          ) : (
            <div className="empty-panel">
              <div className="empty-symbol" aria-hidden="true">○</div>
              <div>
                <h3>
                  {remaining.length > 0 ? "Choose what matters" : "A fresh day"}
                </h3>
                <p>
                  {remaining.length > 0
                    ? "Your Today list is ready. Pick up to three outcomes for the day."
                    : "Capture something, move it to Today, then choose the few things worth finishing."}
                </p>
              </div>
            </div>
          )}

          {remaining.length > 0 ? (
            <div className="today-pool">
              <p className="section-kicker">Also today</p>
              <ul className="task-list">
                {remaining.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                  onRename={onRename}
                  onRemove={onRemove}
                    actions={
                      <>
                        <button
                          type="button"
                          className="text-action"
                          disabled={top3.length >= 3}
                          aria-label={`Add ${task.title} to Top 3`}
                          onClick={() => onAddToTop3(task.id)}
                        >
                          Top 3
                        </button>
                        <button
                          type="button"
                          className="text-action positive-action"
                          aria-label={`Complete ${task.title}`}
                          onClick={() => onComplete(task.id)}
                        >
                          Done
                        </button>
                      </>
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {gettingStartedStage === null ? (
        <CalendarContextPanel
          calendar={calendar}
          awareness={calendarAwareness}
          onImport={onImportCalendar}
          onClear={onClearCalendar}
        />
      ) : null}
    </div>
  );
}
