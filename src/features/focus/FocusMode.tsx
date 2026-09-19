import {
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import {
  formatFocusClock,
  getFocusProgress,
  getFocusRemainingMs,
} from "../../domain/daydock/focus";
import type { ActiveFocusSession, Task } from "../../domain/daydock/model";

interface FocusModeProps {
  session: ActiveFocusSession;
  task: Task;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onComplete: () => void;
}

export function FocusMode({
  session,
  task,
  onPause,
  onResume,
  onStop,
  onComplete,
}: FocusModeProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const tick = useEffectEvent(() => {
    setNowMs(Date.now());
  });

  useEffect(() => {
    const intervalId = window.setInterval(tick, 1_000);

    function syncAfterVisibilityChange() {
      if (document.visibilityState === "visible") {
        tick();
      }
    }

    document.addEventListener("visibilitychange", syncAfterVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncAfterVisibilityChange);
    };
  }, []);

  const remainingMs = getFocusRemainingMs(session, nowMs);
  const progress = getFocusProgress(session, nowMs);
  const isPaused = session.pausedAt !== null;
  const isComplete = remainingMs === 0;

  return (
    <main className="focus-shell" aria-labelledby="focus-task-title">
      <header className="focus-topbar">
        <div className="brand-lockup compact-brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          <div>
            <strong className="brand-name">DayDock</strong>
            <span className="brand-subtitle">Focus</span>
          </div>
        </div>
        <button type="button" className="focus-exit" onClick={onStop}>
          End session
        </button>
      </header>

      <section className="focus-stage">
        <p className="focus-kicker">
          {isComplete ? "Session complete" : isPaused ? "Paused" : "Deep focus"}
        </p>

        <div
          className="focus-progress-ring"
          style={{ "--focus-progress": progress } as React.CSSProperties}
          aria-hidden="true"
        >
          <div className="focus-clock" aria-live="off">
            {formatFocusClock(remainingMs)}
          </div>
        </div>

        <div className="focus-copy">
          <h1 id="focus-task-title">{task.title}</h1>
          <p>
            {isComplete
              ? "You made the space. Decide whether this task is done or simply stop the session."
              : "One thing at a time."}
          </p>
        </div>

        <div className="focus-actions">
          {!isComplete ? (
            <button
              type="button"
              className="focus-secondary"
              onClick={isPaused ? onResume : onPause}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          ) : null}
          <button
            type="button"
            className="focus-primary"
            onClick={onComplete}
          >
            Complete task
          </button>
        </div>

        <p className="focus-footnote">
          {session.durationMinutes} min session · saved locally
        </p>
      </section>
    </main>
  );
}
