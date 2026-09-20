import type { Task, TaskRecurrence } from "../../domain/daydock/model";
import { recurrenceLabel } from "../../domain/daydock/scheduling";
import { TaskRow } from "../tasks/TaskRow";
import { TaskScheduleDialog } from "../tasks/TaskScheduleDialog";

interface InboxSurfaceProps {
  inboxTasks: Task[];
  laterTasks: Task[];
  todayKey: string;
  onMoveInbox: (taskId: string) => void;
  onMoveToday: (taskId: string) => void;
  onSchedule: (
    taskId: string,
    deferUntil: string | null,
    recurrence: TaskRecurrence | null,
  ) => void;
  onComplete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onRemove: (taskId: string) => void;
}

function formatReturnDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function TimingMeta({
  task,
  ready = false,
}: {
  task: Task;
  ready?: boolean;
}) {
  if (task.deferUntil === null && task.recurrence === null) return null;

  return (
    <>
      {task.deferUntil !== null ? (
        <span className={ready ? "resurface-meta is-ready" : "resurface-meta"}>
          {ready ? "Ready again" : `Returns ${formatReturnDate(task.deferUntil)}`}
        </span>
      ) : null}
      {task.recurrence !== null ? (
        <span className="resurface-meta">
          Repeats {recurrenceLabel(task.recurrence.kind).toLocaleLowerCase()}
        </span>
      ) : null}
    </>
  );
}

export function InboxSurface({
  inboxTasks,
  laterTasks,
  todayKey,
  onMoveInbox,
  onMoveToday,
  onSchedule,
  onComplete,
  onRename,
  onRemove,
}: InboxSurfaceProps) {
  const readyTasks = inboxTasks.filter(
    (task) => task.deferUntil !== null && task.deferUntil <= todayKey,
  );
  const unsortedTasks = inboxTasks.filter(
    (task) => !readyTasks.some((ready) => ready.id === task.id),
  );
  const orderedLater = [...laterTasks].sort((left, right) => {
    if (left.deferUntil === null && right.deferUntil === null) return 0;
    if (left.deferUntil === null) return 1;
    if (right.deferUntil === null) return -1;
    return left.deferUntil.localeCompare(right.deferUntil);
  });
  const nothingStored = inboxTasks.length === 0 && laterTasks.length === 0;

  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Safe to forget</p>
        <h1>Inbox</h1>
        <p className="intro-copy">
          Capture first. DayDock can bring deferred work back when it deserves
          attention, without turning every task into a deadline.
        </p>
      </section>

      {nothingStored ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">✓</div>
          <div>
            <h2>Nothing waiting</h2>
            <p>
              New captures and intentionally deferred work will return here when
              they need a decision.
            </p>
          </div>
        </div>
      ) : (
        <>
          {readyTasks.length > 0 ? (
            <section
              className="section-block ready-again-section"
              aria-labelledby="ready-again-title"
            >
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Ready again</p>
                  <h2 id="ready-again-title">
                    You asked DayDock to bring {readyTasks.length === 1 ? "this" : "these"} back
                  </h2>
                </div>
                <span className="count-pill">{readyTasks.length}</span>
              </div>
              <p className="section-support-copy">
                Nothing is overdue. Decide whether it belongs Today, needs more
                time, or is already done.
              </p>
              <ul className="task-list">
                {readyTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    metadata={<TimingMeta task={task} ready />}
                    onRename={onRename}
                    onRemove={onRemove}
                    actions={
                      <>
                        <button
                          type="button"
                          className="text-action"
                          aria-label={`Move ${task.title} to Today`}
                          onClick={() => onMoveToday(task.id)}
                        >
                          Today
                        </button>
                        <TaskScheduleDialog
                          task={task}
                          todayKey={todayKey}
                          triggerLabel="Snooze"
                          onSchedule={onSchedule}
                        />
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
          ) : null}

          <section className="section-block" aria-labelledby="inbox-items-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Unsorted</p>
                <h2 id="inbox-items-title">
                  {unsortedTasks.length === 0
                    ? "Inbox clear"
                    : `${unsortedTasks.length} item${unsortedTasks.length === 1 ? "" : "s"} waiting`}
                </h2>
              </div>
              {unsortedTasks.length > 0 ? (
                <span className="count-pill">{unsortedTasks.length}</span>
              ) : null}
            </div>

            {unsortedTasks.length === 0 ? (
              <div className="empty-panel compact-empty-panel">
                <div className="empty-symbol" aria-hidden="true">✓</div>
                <div>
                  <h3>Nothing new to sort</h3>
                  <p>
                    Scheduled and someday work stays safely below until it is
                    ready again.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="task-list">
                {unsortedTasks.map((task) => (
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
                          aria-label={`Move ${task.title} to Today`}
                          onClick={() => onMoveToday(task.id)}
                        >
                          Today
                        </button>
                        <TaskScheduleDialog
                          task={task}
                          todayKey={todayKey}
                          onSchedule={onSchedule}
                        />
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
            )}
          </section>

          <section className="section-block later-section" aria-labelledby="later-items-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Deferred intentionally</p>
                <h2 id="later-items-title">Later</h2>
              </div>
              <span className="count-pill">{laterTasks.length}</span>
            </div>

            {laterTasks.length === 0 ? (
              <p className="section-support-copy">
                Nothing parked for later. Use Later when something matters, just
                not now.
              </p>
            ) : (
              <>
                <p className="section-support-copy">
                  Dated items will come back automatically. Someday items stay
                  quiet until you choose them.
                </p>
                <ul className="task-list">
                  {orderedLater.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      metadata={<TimingMeta task={task} />}
                      onRename={onRename}
                      onRemove={onRemove}
                      actions={
                        <>
                          <button
                            type="button"
                            className="text-action"
                            aria-label={`Move ${task.title} to Today`}
                            onClick={() => onMoveToday(task.id)}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            className="text-action"
                            aria-label={`Move ${task.title} back to Inbox`}
                            onClick={() => onMoveInbox(task.id)}
                          >
                            Inbox
                          </button>
                          <TaskScheduleDialog
                            task={task}
                            todayKey={todayKey}
                            triggerLabel="Reschedule"
                            onSchedule={onSchedule}
                          />
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
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
