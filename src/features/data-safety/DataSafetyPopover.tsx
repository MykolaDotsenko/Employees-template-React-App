import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { DayDockState } from "../../domain/daydock/model";
import {
  DAYDOCK_BACKUP_MAX_BYTES,
  parseDayDockBackup,
  serializeDayDockBackup,
  summarizeDayDockBackup,
  type DayDockBackup,
} from "../../storage/dayDockBackup";

const POPOVER_ID = "daydock-data-safety";

interface DataSafetyPopoverProps {
  state: DayDockState;
  onRestore: (state: DayDockState) => void;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Unable to read backup file."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Backup file is not text."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsText(file);
  });
}

function formatExportedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function backupFilename(): string {
  return `daydock-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadBackup(state: DayDockState): void {
  const text = serializeDayDockBackup(state);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = backupFilename();
  anchor.hidden = true;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  queueMicrotask(() => URL.revokeObjectURL(url));
}

export function DataSafetyPopover({
  state,
  onRestore,
}: DataSafetyPopoverProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<DayDockBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const summary =
    candidate === null ? null : summarizeDayDockBackup(candidate.state);

  function resetImport() {
    setCandidate(null);
    setMessage(null);
    setHasError(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setCandidate(null);
    setMessage(null);
    setHasError(false);

    if (!file) return;

    if (file.size > DAYDOCK_BACKUP_MAX_BYTES) {
      setHasError(true);
      setMessage("Backup is too large. DayDock accepts files up to 5 MB.");
      return;
    }

    try {
      const backup = parseDayDockBackup(await readFileText(file));

      if (backup === null) {
        setHasError(true);
        setMessage("This file is not a valid DayDock backup.");
        return;
      }

      setCandidate(backup);
      setMessage("Ready to restore.");
    } catch {
      setHasError(true);
      setMessage("DayDock could not read this backup file.");
    }
  }

  function restoreCandidate() {
    if (candidate === null) return;

    onRestore(candidate.state);
    setCandidate(null);
    setHasError(false);
    setMessage("Workspace restored. Open tabs will receive the new state.");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        className="local-badge data-safety-trigger"
        popoverTarget={POPOVER_ID}
        aria-label="Open data and recovery"
      >
        <span className="data-safety-dot" aria-hidden="true" />
        <span>Private by default</span>
      </button>

      <aside
        id={POPOVER_ID}
        className="data-safety-popover"
        popover="auto"
        aria-label="Data and recovery"
      >
        <header className="data-safety-heading">
          <div>
            <p className="section-kicker">Local-first</p>
            <h2>Your data stays portable</h2>
          </div>
          <span className="privacy-dot" aria-hidden="true" />
        </header>

        <p className="data-safety-copy">
          DayDock saves this workspace in your browser. Export a portable backup
          before clearing browser data or moving to another device.
        </p>

        <div className="data-safety-actions">
          <button
            type="button"
            className="data-safety-primary"
            onClick={() => downloadBackup(state)}
          >
            Export backup
          </button>

          <label className="data-safety-secondary" htmlFor={inputId}>
            Choose backup file
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={handleBackupFile}
          />
        </div>

        {message ? (
          <p
            className={hasError ? "backup-status is-error" : "backup-status"}
            role="status"
          >
            {message}
          </p>
        ) : null}

        {candidate && summary ? (
          <section className="backup-preview" aria-label="Backup preview">
            <div className="backup-preview-heading">
              <div>
                <strong>Ready to restore</strong>
                <span>{formatExportedAt(candidate.exportedAt)}</span>
              </div>
              <button type="button" onClick={resetImport}>
                Clear
              </button>
            </div>

            <dl>
              <div>
                <dt>Tasks</dt>
                <dd>{summary.taskCount}</dd>
              </div>
              <div>
                <dt>People</dt>
                <dd>{summary.personCount}</dd>
              </div>
              <div>
                <dt>Focus sessions</dt>
                <dd>{summary.focusSessionCount}</dd>
              </div>
            </dl>

            <div className="backup-restore-note">
              <p>
                Restoring replaces the current workspace on this browser and
                syncs the restored state to other open DayDock tabs.
              </p>
              <button
                type="button"
                className="backup-restore-button"
                onClick={restoreCandidate}
              >
                Restore backup
              </button>
            </div>
          </section>
        ) : null}

        <footer className="data-safety-footer">
          No account · no cloud sync · no upload during export
        </footer>
      </aside>
    </>
  );
}
