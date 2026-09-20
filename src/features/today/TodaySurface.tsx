import { ViewTransition } from "react";
import type { Task } from "../../domain/daydock/model";
import { TaskRow } from "../tasks/TaskRow";

interface TodaySurfaceProps {
  top3: Task[];
  todayTasks: Task[];
  onAddToTop3: (taskId: string) => void;
  onRemoveFromTop3: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

export function TodaySurface({
  top3,
  todayTasks,
  onAddToTop3,
  onRemoveFromTop3,
  onComplete,
  onStartFocus,
}: TodaySurfaceProps) {
  const top3Ids = new Set(top3.map((task) => task.id));
  const remaining = todayTasks.filter((task) => !top3Ids.has(task.id));
  const currentTask = top3[0] ?? null;

  return (
    <div className="surface-stack">
      <section className="intro-block" aria-labelledby="today-title">
        <p className="eyebrow">A clear start</p>
        <h1 id="today-title">Today</h1>
        <p className="intro-copy">
          Keep the day small. Choose up to three outcomes worth finishing.
        </p>
      </section>

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
              <h3>{remaining.length > 0 ? "Choose what matters" : "A fresh day"}</h3>
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
            <button
              type="button"
              className="start-focus-button"
              onClick={() => onStartFocus(currentTask.id)}
            >
              Start focus
              <span aria-hidden="true">
                {currentTask.estimateMinutes ?? 50} min
              </span>
            </button>
          ) : null}
        </div>
        <span className="now-orbit" aria-hidden="true" />
      </section>
    </div>
  );
}
