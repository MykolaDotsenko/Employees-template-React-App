import type { Task } from "../../domain/daydock/model";
import { TaskRow } from "../tasks/TaskRow";

interface InboxSurfaceProps {
  tasks: Task[];
  onMoveToday: (taskId: string) => void;
  onMoveLater: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

export function InboxSurface({
  tasks,
  onMoveToday,
  onMoveLater,
  onComplete,
}: InboxSurfaceProps) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Safe to forget</p>
        <h1>Inbox</h1>
        <p className="intro-copy">
          Capture first. Decide later. Nothing here needs to compete with your focus.
        </p>
      </section>

      {tasks.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">✓</div>
          <div>
            <h2>Inbox clear</h2>
            <p>Nothing is asking for your attention.</p>
          </div>
        </div>
      ) : (
        <section className="section-block" aria-labelledby="inbox-items-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Unsorted</p>
              <h2 id="inbox-items-title">
                {tasks.length} item{tasks.length === 1 ? "" : "s"} waiting
              </h2>
            </div>
          </div>

          <ul className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
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
        </section>
      )}
    </div>
  );
}
