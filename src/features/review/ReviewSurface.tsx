import type { CSSProperties } from "react";
import {
  getRecordedFocusMs,
  type DayInsight,
  type ReviewInsights,
} from "../../domain/daydock/insights";
import type { Task } from "../../domain/daydock/model";
import type { PaletteSurface } from "../command-palette/CommandPalette";
import { TaskRow } from "../tasks/TaskRow";

interface ReviewSurfaceProps {
  completedToday: Task[];
  openToday: Task[];
  focusMinutesToday: number;
  focusSessionsToday: ReviewInsights["focusSessionsToday"];
  week: DayInsight[];
  tasksById: Record<string, Task>;
  inboxCount: number;
  dueFollowUpsCount: number;
  onMoveLater: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onNavigate: (surface: PaletteSurface) => void;
}

function shortDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatFocusMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function ReviewSurface({
  completedToday,
  openToday,
  focusMinutesToday,
  focusSessionsToday,
  week,
  tasksById,
  inboxCount,
  dueFollowUpsCount,
  onMoveLater,
  onComplete,
  onNavigate,
}: ReviewSurfaceProps) {
  const maxFocus = Math.max(1, ...week.map((day) => day.focusMinutes));
  const activeFocusDays = week.filter((day) => day.focusMinutes > 0).length;

  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Close the loop</p>
        <h1>Review</h1>
        <p className="intro-copy">
          See what moved, give unfinished work a clear home, then leave the day
          behind.
        </p>
      </section>

      <section className="review-metrics" aria-label="Today summary">
        <div className="review-metric">
          <strong>{completedToday.length}</strong>
          <span>completed today</span>
        </div>
        <div className="review-metric">
          <strong>{formatFocusMinutes(focusMinutesToday)}</strong>
          <span>focused today</span>
        </div>
        <div className="review-metric">
          <strong>{openToday.length}</strong>
          <span>still needs a home</span>
        </div>
      </section>

      {focusSessionsToday.length > 0 ? (
        <section
          className="review-focus-sessions"
          aria-labelledby="focus-sessions-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Today</p>
              <h2 id="focus-sessions-title">Focus blocks</h2>
            </div>
            <span className="count-pill">{focusSessionsToday.length}</span>
          </div>

          <ul>
            {focusSessionsToday.map((session) => {
              const task = tasksById[session.taskId];
              const minutes = Math.round(getRecordedFocusMs(session) / 60_000);

              return (
                <li key={session.id}>
                  <div>
                    <strong>{task?.title ?? "Task no longer available"}</strong>
                    <span>
                      {session.outcome === "completed"
                        ? "Completed from focus"
                        : "Session ended"} · {formatFocusMinutes(minutes)}
                    </span>
                  </div>
                  <span
                    className={
                      session.outcome === "completed"
                        ? "focus-outcome is-complete"
                        : "focus-outcome"
                    }
                  >
                    {session.outcome === "completed" ? "Done" : "Stopped"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {openToday.length > 0 ? (
        <section className="section-block" aria-labelledby="unfinished-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Needs a home</p>
              <h2 id="unfinished-title">Before you close the day</h2>
            </div>
          </div>

          <ul className="task-list">
            {openToday.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                actions={
                  <>
                    <button
                      type="button"
                      className="text-action"
                      aria-label={`Move ${task.title} to Later`}
                      onClick={() => onMoveLater(task.id)}
                    >
                      Later
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
        </section>
      ) : (
        <div className="review-closure">
          <span className="review-closure-mark" aria-hidden="true">✓</span>
          <div>
            <h2>Everything has a home</h2>
            <p>
              Nothing from Today is left unresolved. You can close the day
              without carrying it in your head.
            </p>
          </div>
        </div>
      )}

      <section className="week-insights" aria-labelledby="week-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Last 7 days</p>
            <h2 id="week-title">Your focus rhythm</h2>
          </div>
          <span className="count-pill">{activeFocusDays} active</span>
        </div>

        <div className="week-bars" role="img" aria-label="Focus minutes over the last seven days">
          {week.map((day) => {
            const level = day.focusMinutes / maxFocus;

            return (
              <div className="week-day" key={day.dateKey}>
                <div className="week-bar-track">
                  <span
                    className="week-bar"
                    style={{ "--week-level": level } as CSSProperties}
                  />
                </div>
                <span className="week-day-label">{shortDay(day.dateKey)}</span>
                <small>
                  {day.focusMinutes > 0
                    ? formatFocusMinutes(day.focusMinutes)
                    : "—"}
                </small>
              </div>
            );
          })}
        </div>

        <p className="week-note">
          {activeFocusDays >= 3
            ? "A pattern is forming. DayDock shows the rhythm without grading it."
            : "After a few focus sessions, useful patterns will start to emerge here."}
        </p>
      </section>

      <section className="review-next-attention" aria-labelledby="next-attention-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Next attention</p>
            <h2 id="next-attention-title">Anything still waiting?</h2>
          </div>
        </div>

        <div className="review-next-attention-grid">
          <button type="button" onClick={() => onNavigate("inbox")}>
            <span>
              <strong>Inbox</strong>
              <small>
                {inboxCount === 0
                  ? "Already clear"
                  : `${inboxCount} item${inboxCount === 1 ? "" : "s"} waiting`}
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </button>

          <button type="button" onClick={() => onNavigate("people")}>
            <span>
              <strong>People</strong>
              <small>
                {dueFollowUpsCount === 0
                  ? "No follow-ups due"
                  : `${dueFollowUpsCount} follow-up${dueFollowUpsCount === 1 ? "" : "s"} due`}
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {completedToday.length > 0 ? (
        <section className="completed-today" aria-labelledby="completed-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Done</p>
              <h2 id="completed-title">What moved today</h2>
            </div>
          </div>
          <ul>
            {completedToday.map((task) => (
              <li key={task.id}>
                <span aria-hidden="true">✓</span>
                {task.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
