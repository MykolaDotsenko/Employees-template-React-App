import { useState, type CSSProperties, type ChangeEvent } from "react";
import type { DayInsight } from "../../domain/daydock/insights";
import type { Task } from "../../domain/daydock/model";
import { TaskRow } from "../tasks/TaskRow";

interface ReviewSurfaceProps {
  completedToday: Task[];
  openToday: Task[];
  focusMinutesToday: number;
  week: DayInsight[];
  onMoveLater: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onExportBackup: () => boolean;
  onImportBackup: (file: File) => Promise<boolean>;
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
  week,
  onMoveLater,
  onComplete,
  onExportBackup,
  onImportBackup,
}: ReviewSurfaceProps) {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const maxFocus = Math.max(1, ...week.map((day) => day.focusMinutes));
  const activeFocusDays = week.filter((day) => day.focusMinutes > 0).length;

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setBackupStatus("Checking backup…");
    const imported = await onImportBackup(file);
    setBackupStatus(
      imported
        ? "Backup restored. Your local workspace is up to date."
        : "That file is not a valid DayDock backup.",
    );
  }

  function exportBackup() {
    const exported = onExportBackup();
    setBackupStatus(
      exported
        ? "Backup downloaded."
        : "This browser could not create a backup file.",
    );
  }

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

      <section className="data-safety" aria-labelledby="data-safety-title">
        <div>
          <p className="section-kicker">Data & privacy</p>
          <h2 id="data-safety-title">Your workspace stays portable</h2>
          <p>
            DayDock stores your workspace in this browser and syncs changes only
            between open DayDock tabs on this device. Export a JSON backup any time.
          </p>
        </div>

        <div className="data-actions">
          <button type="button" onClick={exportBackup}>
            Export backup
          </button>
          <label>
            Import backup
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={importBackup}
            />
          </label>
        </div>

        <p className="data-status" aria-live="polite">
          {backupStatus ?? "No account · no cloud upload · no tracking"}
        </p>
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
