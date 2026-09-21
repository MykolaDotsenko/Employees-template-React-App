import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Task } from "../../domain/daydock/model";

interface TaskRowProps {
  task: Task;
  leading?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  revealToken?: number;
  onRename?: (taskId: string, title: string) => void;
  onEstimateChange?: (taskId: string, estimateMinutes: number | null) => void;
  onRemove?: (taskId: string) => void;
}

export function TaskRow({
  task,
  leading,
  metadata,
  actions,
  revealToken,
  onRename,
  onEstimateChange,
  onRemove,
}: TaskRowProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const titleId = useId();
  const estimateHelpId = useId();
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftEstimate, setDraftEstimate] = useState(
    task.estimateMinutes?.toString() ?? "",
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const canManage =
    onRename !== undefined ||
    onEstimateChange !== undefined ||
    onRemove !== undefined;
  const parsedEstimate =
    draftEstimate.trim() === "" ? null : Number(draftEstimate);
  const estimateIsValid =
    parsedEstimate === null ||
    (Number.isInteger(parsedEstimate) &&
      parsedEstimate > 0 &&
      parsedEstimate <= 24 * 60);

  useEffect(() => {
    if (revealToken === undefined) return;

    const row = rowRef.current;
    if (!row) return;

    row.scrollIntoView?.({ block: "center" });
    row.focus();
  }, [revealToken]);

  function openEditor() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    setDraftTitle(task.title);
    setDraftEstimate(task.estimateMinutes?.toString() ?? "");
    setConfirmingRemove(false);
    dialog.showModal();
  }

  function closeEditor() {
    setConfirmingRemove(false);
    dialogRef.current?.close();
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = draftTitle.trim();
    if (onRename !== undefined && !nextTitle) return;
    if (!estimateIsValid) return;

    onRename?.(task.id, nextTitle);
    onEstimateChange?.(task.id, parsedEstimate);
    closeEditor();
  }

  function removeTask() {
    if (onRemove === undefined) return;
    onRemove(task.id);
    closeEditor();
  }

  return (
    <li
      ref={rowRef}
      className={revealToken === undefined ? "task-row" : "task-row is-revealed"}
      tabIndex={revealToken === undefined ? undefined : -1}
    >
      <span className="task-leading" aria-hidden="true">
        {leading ?? <span className="task-dot" />}
      </span>
      <span className="task-copy">
        <strong>{task.title}</strong>
        {task.estimateMinutes !== null || metadata ? (
          <span className="task-meta">
            {task.estimateMinutes !== null ? (
              <span>{task.estimateMinutes} min</span>
            ) : null}
            {metadata}
          </span>
        ) : null}
      </span>
      {actions || canManage ? (
        <span className="task-actions">
          {actions}
          {canManage ? (
            <button
              type="button"
              className="task-more-button"
              aria-label={`Edit or remove ${task.title}`}
              onClick={openEditor}
            >
              <span aria-hidden="true">•••</span>
            </button>
          ) : null}
        </span>
      ) : null}

      {canManage ? (
        <dialog
          ref={dialogRef}
          className="task-editor-dialog"
          aria-labelledby={titleId}
          onCancel={() => setConfirmingRemove(false)}
        >
          {confirmingRemove ? (
            <div className="task-remove-confirmation">
              <p className="section-kicker">Remove task</p>
              <h2 id={titleId}>Remove “{task.title}”?</h2>
              <p>
                This clears the task and any focus history attached to it. You
                can undo immediately after removal.
              </p>
              <div className="task-editor-actions">
                <button
                  type="button"
                  className="task-editor-secondary"
                  onClick={() => setConfirmingRemove(false)}
                >
                  Keep task
                </button>
                <button
                  type="button"
                  className="task-editor-danger"
                  onClick={removeTask}
                >
                  Remove task
                </button>
              </div>
            </div>
          ) : (
            <form className="task-editor-form" onSubmit={saveTask}>
              <div>
                <p className="section-kicker">Task details</p>
                <h2 id={titleId}>Keep the wording useful</h2>
              </div>

              {onRename !== undefined ? (
                <label className="task-editor-field">
                  <span>Task title</span>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.currentTarget.value)}
                    maxLength={280}
                    autoFocus
                  />
                </label>
              ) : null}

              {onEstimateChange !== undefined ? (
                <label className="task-editor-field">
                  <span>Estimate</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={24 * 60}
                    value={draftEstimate}
                    aria-label="Estimate"
                    aria-describedby={estimateHelpId}
                    aria-invalid={!estimateIsValid}
                    placeholder="No estimate"
                    onChange={(event) =>
                      setDraftEstimate(event.currentTarget.value)
                    }
                  />
                  <small
                    id={estimateHelpId}
                    className={
                      estimateIsValid
                        ? "task-editor-field-help"
                        : "task-editor-field-help is-error"
                    }
                  >
                    {estimateIsValid
                      ? "Optional minutes · used to prefill Focus, never scored."
                      : "Enter a whole number from 1 to 1440 minutes."}
                  </small>
                </label>
              ) : null}

              <div className="task-editor-actions">
                {onRemove !== undefined ? (
                  <button
                    type="button"
                    className="task-editor-remove-link"
                    onClick={() => setConfirmingRemove(true)}
                  >
                    Remove…
                  </button>
                ) : null}
                <span className="task-editor-action-spacer" />
                <button
                  type="button"
                  className="task-editor-secondary"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
                {onRename !== undefined || onEstimateChange !== undefined ? (
                  <button
                    type="submit"
                    className="task-editor-primary"
                    disabled={
                      (onRename !== undefined && !draftTitle.trim()) ||
                      !estimateIsValid
                    }
                  >
                    Save changes
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </dialog>
      ) : null}
    </li>
  );
}
