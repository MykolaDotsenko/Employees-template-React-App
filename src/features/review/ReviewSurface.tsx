import type { Task } from "../../domain/daydock/model";
import type { ReviewSnapshot } from "../../domain/daydock/selectors";
import type { PaletteSurface } from "../command-palette/CommandPalette";

interface ReviewSurfaceProps {
  snapshot: ReviewSnapshot;
  tasksById: Record<string, Task>;
  onNavigate: (surface: PaletteSurface) => void;
  onParkForLater: (taskId: string) => void;
}

function formatFocusDuration(milliseconds: number): string {
  if (milliseconds <= 0) return "0 min";
  if (milliseconds < 60_000) return "<1 min";

  const totalMinutes = Math.round(milliseconds / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ReviewSurface({
  snapshot,
  tasksById,
  onNavigate,
  onParkForLater,
}: ReviewSurfaceProps) {
  const stoppedSessions = snapshot.focusSessions.filter(
    (session) => session.outcome === "stopped",
  ).length;

  return (
    <div className="surface-stack review-surface">
      <section className="intro-block">
        <p className="eyebrow">Close the loop</p>
        <h1>Review</h1>
        <p className="intro-copy">
          See what moved, notice what still needs a home, then leave the day
          without a score hanging over you.
        </p>
      </section>

      <section className="review-metrics" aria-label="Today at a glance">
        <article className="review-metric">
          <span className="review-metric-value">
            {snapshot.completedTasks.length}
          </span>
          <span className="review-metric-label">completed today</span>
        </article>

        <article className="review-metric">
          <span className="review-metric-value">
            {formatFocusDuration(snapshot.focusMs)}
          </span>
          <span className="review-metric-label">
            focused · {snapshot.focusSessions.length} session
            {snapshot.focusSessions.length === 1 ? "" : "s"}
          </span>
        </article>

        <article className="review-metric">
          <span className="review-metric-value">
            {snapshot.openTodayTasks.length}
          </span>
          <span className="review-metric-label">open Today loops</span>
        </article>

        <article className="review-metric">
          <span className="review-metric-value">{snapshot.inboxCount}</span>
          <span className="review-metric-label">waiting in Inbox</span>
        </article>
      </section>

      <section className="review-section" aria-labelledby="wins-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">What moved</p>
            <h2 id="wins-title">Today’s wins</h2>
          </div>
          <span className="count-pill">{snapshot.completedTasks.length}</span>
        </div>

        {snapshot.completedTasks.length > 0 ? (
          <ul className="review-list">
            {snapshot.completedTasks.map((task) => (
              <li key={task.id}>
                <span className="review-list-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {task.completedAt
                      ? `Finished ${formatTime(task.completedAt)}`
                      : "Finished today"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="review-quiet-state">
            <strong>The day is still open.</strong>
            <span>
              Completion is useful context, not a requirement for a good day.
            </span>
          </div>
        )}
      </section>

      <section className="review-section" aria-labelledby="focus-review-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Protected attention</p>
            <h2 id="focus-review-title">Focus blocks</h2>
          </div>
          {stoppedSessions > 0 ? (
            <span className="review-soft-note">
              {stoppedSessions} stopped early
            </span>
          ) : null}
        </div>

        {snapshot.focusSessions.length > 0 ? (
          <ul className="review-focus-list">
            {snapshot.focusSessions.map((session) => {
              const task = tasksById[session.taskId];
              const sessionMs = Math.max(
                0,
                Date.parse(session.endedAt) -
                  Date.parse(session.startedAt) -
                  session.accumulatedPauseMs,
              );

              return (
                <li key={session.id}>
                  <div>
                    <strong>{task?.title ?? "Deleted task"}</strong>
                    <span>
                      {formatTime(session.startedAt)} → {formatTime(session.endedAt)}
                    </span>
                  </div>
                  <span className="review-focus-duration">
                    {formatFocusDuration(sessionMs)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="review-quiet-state">
            <strong>No focus block today.</strong>
            <span>That is information, not a broken streak.</span>
          </div>
        )}
      </section>

      <section
        className="review-section review-open-loops"
        aria-labelledby="loops-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-kicker">Before you leave</p>
            <h2 id="loops-title">Open loops need a home</h2>
          </div>
        </div>

        {snapshot.openTodayTasks.length > 0 ? (
          <ul className="review-loop-list">
            {snapshot.openTodayTasks.map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <button
                  type="button"
                  aria-label={`Park ${task.title} for later`}
                  onClick={() => onParkForLater(task.id)}
                >
                  Park for later
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="review-quiet-state positive">
            <strong>Today is closed.</strong>
            <span>Nothing from Today needs another decision.</span>
          </div>
        )}
      </section>

      <section className="review-next-actions" aria-label="Next actions">
        <button type="button" onClick={() => onNavigate("inbox")}>
          <span>
            <strong>Inbox</strong>
            <small>
              {snapshot.inboxCount === 0
                ? "Already clear"
                : `${snapshot.inboxCount} item${snapshot.inboxCount === 1 ? "" : "s"} waiting`}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>

        <button type="button" onClick={() => onNavigate("people")}>
          <span>
            <strong>People</strong>
            <small>
              {snapshot.duePeopleCount === 0
                ? "No follow-ups due"
                : `${snapshot.duePeopleCount} follow-up${snapshot.duePeopleCount === 1 ? "" : "s"} due`}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  );
}
