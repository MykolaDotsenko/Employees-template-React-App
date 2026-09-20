import type { Task } from "../../domain/daydock/model";
import { TaskRow } from "../tasks/TaskRow";

interface InboxSurfaceProps {
  inboxTasks: Task[];
  laterTasks: Task[];
  onMoveInbox: (taskId: string) => void;
  onMoveToday: (taskId: string) => void;
  onMoveLater: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onRemove: (taskId: string) => void;
}

export function InboxSurface({
  inboxTasks,
  laterTasks,
  onMoveInbox,
  onMoveToday,
  onMoveLater,
  onComplete,
  onRename,
  onRemove,
}: InboxSurfaceProps) {
  const nothingStored = inboxTasks.length === 0 && laterTasks.length === 0;

  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Safe to forget</p>
        <h1>Inbox</h1>
        <p className="intro-copy">
          Capture first, decide what matters, and keep deferred work visible
          without letting it compete with today.
        </p>
      </section>

      {nothingStored ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">✓</div>
          <div>
            <h2>Nothing waiting</h2>
            <p>New captures and intentionally deferred work will stay visible here.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="section-block" aria-labelledby="inbox-items-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Unsorted</p>
                <h2 id="inbox-items-title">
                  {inboxTasks.length === 0
                    ? "Inbox clear"
                    : `${inboxTasks.length} item${inboxTasks.length === 1 ? "" : "s"} waiting`}
                </h2>
              </div>
              {inboxTasks.length > 0 ? (
                <span className="count-pill">{inboxTasks.length}</span>
              ) : null}
            </div>

            {inboxTasks.length === 0 ? (
              <div className="empty-panel compact-empty-panel">
                <div className="empty-symbol" aria-hidden="true">✓</div>
                <div>
                  <h3>Nothing new to sort</h3>
                  <p>Your deferred list is still available below.</p>
                </div>
              </div>
            ) : (
              <ul className="task-list">
                {inboxTasks.map((task) => (
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
                Nothing parked for later. Use Later when something matters, just not today.
              </p>
            ) : (
              <>
                <p className="section-support-copy">
                  Parked safely, still visible. Pull an item back when it earns attention.
                </p>
                <ul className="task-list">
                  {laterTasks.map((task) => (
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
                          <button
                            type="button"
                            className="text-action"
                            aria-label={`Move ${task.title} back to Inbox`}
                            onClick={() => onMoveInbox(task.id)}
                          >
                            Inbox
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
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
