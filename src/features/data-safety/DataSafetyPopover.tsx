import {
  useId,
  useRef,
  useState,
} from "react";
import type { DayDockState } from "../../domain/daydock/model";
import type {
  ReadyAgainNotificationPermission,
  ReadyAgainNotificationResult,
} from "../../platform/readyAgainNotifications";
import type { PersistenceStatus } from "../../store/dayDockStore";
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
  persistenceStatus: PersistenceStatus;
  notificationPermission: ReadyAgainNotificationPermission;
  onReadyAgainNotificationsChange: (
    enabled: boolean,
  ) => Promise<ReadyAgainNotificationResult>;
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
  persistenceStatus,
  notificationPermission,
  onReadyAgainNotificationsChange,
  onRestore,
}: DataSafetyPopoverProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<DayDockBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const [notificationBusy, setNotificationBusy] = useState(false);

  const summary =
    candidate === null ? null : summarizeDayDockBackup(candidate.state);
  const readyAgainAlertsActive =
    state.notifications.readyAgain && notificationPermission === "granted";
  const readyAgainPermissionMessage =
    state.notifications.readyAgain && !readyAgainAlertsActive
      ? notificationPermission === "denied"
        ? "Ready again is enabled in this workspace, but notifications are blocked in this browser."
        : notificationPermission === "unsupported"
          ? "Ready again is enabled in this workspace, but this browser cannot show DayDock notifications."
          : "Ready again is enabled in this workspace, but this browser still needs notification permission."
      : null;

  function resetImport() {
    setCandidate(null);
    setMessage(null);
    setHasError(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleBackupFile(file: File | undefined) {
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

  async function changeReadyAgainNotifications(enabled: boolean) {
    setNotificationBusy(true);
    setNotificationMessage(null);

    try {
      const result = await onReadyAgainNotificationsChange(enabled);

      const nextMessage =
        result.status === "enabled"
          ? "Ready again alerts are enabled for this browser."
          : result.status === "disabled"
            ? "Ready again alerts are off."
            : result.status === "denied"
              ? "Notifications are blocked in this browser. You can change that in site settings."
              : result.status === "unsupported"
                ? "This browser does not support DayDock notifications."
                : "DayDock could not update notification permission.";

      setNotificationMessage(nextMessage);
    } finally {
      setNotificationBusy(false);
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
        className={
          persistenceStatus === "durable"
            ? "local-badge data-safety-trigger"
            : "local-badge data-safety-trigger is-warning"
        }
        popoverTarget={POPOVER_ID}
        aria-label={
          persistenceStatus === "durable"
            ? "Open data and recovery"
            : "Open data and recovery — storage warning"
        }
      >
        <span className="data-safety-dot" aria-hidden="true" />
        <span className="data-safety-label data-safety-label-desktop">
          {persistenceStatus === "durable" ? "Private by default" : "Storage warning"}
        </span>
        <span className="data-safety-label data-safety-label-mobile">
          {persistenceStatus === "durable" ? "Data" : "Storage"}
        </span>
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
          <span
            className={
              persistenceStatus === "durable"
                ? "privacy-dot"
                : "privacy-dot is-warning"
            }
            aria-hidden="true"
          />
        </header>

        <p className="data-safety-copy">
          DayDock saves this workspace in your browser. Export a portable backup
          before clearing browser data or moving to another device.
        </p>

        {persistenceStatus !== "durable" ? (
          <p className="data-safety-storage-status" role="status" aria-live="polite">
            {persistenceStatus === "memory"
              ? "Browser storage is unavailable. This workspace is running in memory only, so export a backup before reloading or closing this tab."
              : "DayDock could not save the latest change. Keep this tab open and export a backup now while your workspace is still available."}
          </p>
        ) : null}

        <section
          className="data-safety-notifications"
          aria-labelledby="ready-again-alerts-title"
        >
          <div>
            <strong id="ready-again-alerts-title">Ready again alerts</strong>
            <span>
              Optional system notification when parked work is ready to return.
              DayDock checks while the app is running or when you come back.
            </span>
          </div>

          <button
            type="button"
            className={
              readyAgainAlertsActive
                ? "notification-toggle is-on"
                : "notification-toggle"
            }
            disabled={
              notificationBusy || notificationPermission === "unsupported"
            }
            aria-pressed={readyAgainAlertsActive}
            onClick={() => {
              void changeReadyAgainNotifications(!readyAgainAlertsActive);
            }}
          >
            {notificationBusy
              ? "Updating…"
              : notificationPermission === "unsupported"
                ? "Unavailable"
                : readyAgainAlertsActive
                  ? "Turn off"
                  : "Enable"}
          </button>
        </section>

        {notificationMessage || readyAgainPermissionMessage ? (
          <p className="notification-status" role="status" aria-live="polite">
            {notificationMessage ?? readyAgainPermissionMessage}
          </p>
        ) : null}

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
            onChange={(event) => {
              void handleBackupFile(event.currentTarget.files?.[0]);
            }}
          />
        </div>

        {message ? (
          <p
            className={hasError ? "backup-status is-error" : "backup-status"}
            role={hasError ? "alert" : "status"}
            aria-live={hasError ? "assertive" : "polite"}
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
                syncs the restored state to other open DayDock tabs. Notification
                permission is browser-specific and is never restored automatically.
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
