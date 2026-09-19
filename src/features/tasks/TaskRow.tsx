import type { ReactNode } from "react";
import type { Task } from "../../domain/daydock/model";

interface TaskRowProps {
  task: Task;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function TaskRow({ task, leading, actions }: TaskRowProps) {
  return (
    <li className="task-row">
      <span className="task-leading" aria-hidden="true">
        {leading ?? <span className="task-dot" />}
      </span>
      <span className="task-copy">
        <strong>{task.title}</strong>
        <span>
          {task.estimateMinutes !== null
            ? `${task.estimateMinutes} min`
            : "No estimate"}
        </span>
      </span>
      {actions ? <span className="task-actions">{actions}</span> : null}
    </li>
  );
}
