import {
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  Task,
  TaskRecurrence,
  TaskRecurrenceKind,
} from "../../domain/daydock/model";
import {
  addCalendarDays,
  nextMonday,
  recurrenceLabel,
} from "../../domain/daydock/scheduling";

interface TaskScheduleDialogProps {
  task: Task;
  todayKey: string;
  triggerLabel?: string;
  preserveCadence?: boolean;
  onSchedule: (
    taskId: string,
    deferUntil: string | null,
    recurrence: TaskRecurrence | null,
  ) => void;
}

type RecurrenceChoice = "none" | TaskRecurrenceKind;

function formatCalendarDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function TaskScheduleDialog({
  task,
  todayKey,
  triggerLabel = "Later",
  preserveCadence = false,
  onSchedule,
}: TaskScheduleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>("none");
  const tomorrow = addCalendarDays(todayKey, 1);
  const nextWeek = nextMonday(todayKey);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    const existingDate =
      task.deferUntil !== null && task.deferUntil > todayKey
        ? task.deferUntil
        : "";

    setDate(existingDate);
    setRecurrence(task.recurrence?.kind ?? "none");
    dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function chooseDate(nextDate: string) {
    setDate(nextDate);
  }

  function chooseSomeday() {
    setDate("");
    setRecurrence("none");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const repeat: TaskRecurrence | null =
      date && recurrence !== "none"
        ? {
            kind: recurrence,
            anchorDate:
              preserveCadence && task.recurrence?.kind === recurrence
                ? task.recurrence.anchorDate
                : date,
          }
        : null;

    onSchedule(task.id, date || null, repeat);
    closeDialog();
  }

  return (
    <>
      <button
        type="button"
        className="text-action"
        aria-label={`Choose when ${task.title} should return`}
        onClick={openDialog}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="task-schedule-dialog"
        aria-labelledby={titleId}
      >
        <form className="task-schedule-form" onSubmit={submit}>
          <div className="task-schedule-heading">
            <div>
              <p className="section-kicker">Bring it back</p>
              <h2 id={titleId}>When should this come back?</h2>
              <p>{task.title}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close scheduling"
              onClick={closeDialog}
            >
              ×
            </button>
          </div>

          <div className="resurface-quick-grid" aria-label="Quick return dates">
            <button
              type="button"
              className={date === tomorrow ? "is-selected" : undefined}
              onClick={() => chooseDate(tomorrow)}
            >
              <strong>Tomorrow</strong>
              <span>{formatCalendarDate(tomorrow)}</span>
            </button>
            <button
              type="button"
              className={date === nextWeek ? "is-selected" : undefined}
              onClick={() => chooseDate(nextWeek)}
            >
              <strong>Next week</strong>
              <span>{formatCalendarDate(nextWeek)}</span>
            </button>
            <button
              type="button"
              className={!date ? "is-selected" : undefined}
              onClick={chooseSomeday}
            >
              <strong>Someday</strong>
              <span>No date pressure</span>
            </button>
          </div>

          <div className="task-schedule-fields">
            <label>
              <span>Pick a date</span>
              <input
                type="date"
                min={tomorrow}
                value={date}
                onChange={(event) => {
                  setDate(event.currentTarget.value);
                  if (!event.currentTarget.value) setRecurrence("none");
                }}
              />
            </label>

            <label>
              <span>Repeat</span>
              <select
                value={recurrence}
                disabled={!date}
                onChange={(event) =>
                  setRecurrence(event.currentTarget.value as RecurrenceChoice)
                }
              >
                <option value="none">Does not repeat</option>
                {(["daily", "weekdays", "weekly", "monthly"] as const).map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {recurrenceLabel(kind)}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <p className="task-schedule-note">
            {date
              ? preserveCadence &&
                task.recurrence !== null &&
                recurrence === task.recurrence.kind &&
                date !== task.recurrence.anchorDate
                ? `Snoozed until ${formatCalendarDate(date)}. The ${recurrenceLabel(task.recurrence.kind).toLocaleLowerCase()} rhythm stays anchored to its original schedule.`
                : `DayDock will return this to Inbox on ${formatCalendarDate(date)}.`
              : "It stays safely in Later until you choose to bring it back."}
          </p>

          <div className="task-schedule-actions">
            <button
              type="button"
              className="task-editor-secondary"
              onClick={closeDialog}
            >
              Cancel
            </button>
            <button type="submit" className="task-editor-primary">
              Park task
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
