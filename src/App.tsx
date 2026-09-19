import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Task } from "./domain/daydock/model";
import {
  selectFollowUpsDue,
  selectInboxCount,
  selectTasksByStatus,
  selectTop3,
} from "./domain/daydock/selectors";
import { InboxSurface } from "./features/inbox/InboxSurface";
import { QuickCaptureDialog } from "./features/quick-capture/QuickCaptureDialog";
import { TodaySurface } from "./features/today/TodaySurface";
import { dayDockStore } from "./store/browserDayDockStore";
import type { DayDockStore } from "./store/dayDockStore";
import { useDayDockState } from "./store/useDayDockState";

type Surface = "today" | "inbox" | "people" | "review";

interface AppProps {
  store?: DayDockStore;
}

const NAV_ITEMS: readonly { id: Surface; label: string; hint: string }[] = [
  { id: "today", label: "Today", hint: "What matters now" },
  { id: "inbox", label: "Inbox", hint: "Unsorted thoughts" },
  { id: "people", label: "People", hint: "Follow-ups" },
  { id: "review", label: "Review", hint: "Close the loop" },
];

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `task-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

function SurfaceIcon({ surface }: { surface: Surface }) {
  const paths: Record<Surface, ReactNode> = {
    today: (
      <>
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 6.5h16v11H4z" />
        <path d="M4 13h4l1.5 2h5L16 13h4" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16.5" cy="10" r="2.5" />
        <path d="M3.5 19c.5-3.3 2.5-5 5.5-5s5 1.7 5.5 5M14.5 15c2.8.1 4.7 1.4 5.5 4" />
      </>
    ),
    review: (
      <>
        <path d="M5 12.5l4 4L19 6.5" />
        <path d="M4 4h16v16H4z" />
      </>
    ),
  };

  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[surface]}
    </svg>
  );
}

function PeopleSurface({
  duePeople,
}: {
  duePeople: ReturnType<typeof selectFollowUpsDue>;
}) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Things involving other people</p>
        <h1>People</h1>
        <p className="intro-copy">
          Follow-ups stay visible without turning your workday into a CRM.
        </p>
      </section>

      {duePeople.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">↗</div>
          <div>
            <h2>No follow-ups waiting</h2>
            <p>You are all caught up for today.</p>
          </div>
        </div>
      ) : (
        <ul className="simple-list">
          {duePeople.map((person) => (
            <li key={person.id}>
              <strong>{person.name}</strong>
              {person.context ? <span>{person.context}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewSurface({ completedCount }: { completedCount: number }) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Close the loop</p>
        <h1>Review</h1>
        <p className="intro-copy">
          End the day with closure, not a productivity score.
        </p>
      </section>

      <div className="review-summary">
        <div>
          <span className="review-number">{completedCount}</span>
          <span className="review-label">completed</span>
        </div>
        <p>
          Daily wrap-up and gentle weekly patterns arrive after the core Today flow
          is complete.
        </p>
      </div>
    </div>
  );
}

export function App({ store = dayDockStore }: AppProps) {
  const [surface, setSurface] = useState<Surface>("today");
  const captureDialogRef = useRef<HTMLDialogElement>(null);
  const state = useDayDockState(store);

  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const top3 = selectTop3(state);
  const todayTasks = selectTasksByStatus(state, "today");
  const inboxTasks = selectTasksByStatus(state, "inbox");
  const completedTasks = selectTasksByStatus(state, "done");
  const duePeople = selectFollowUpsDue(state, todayKey);
  const inboxCount = selectInboxCount(state);

  function showCaptureDialog() {
    const dialog = captureDialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    dialog.querySelector<HTMLTextAreaElement>("[data-capture-input]")?.focus();
  }

  const openCaptureFromKeyboard = useEffectEvent(() => {
    showCaptureDialog();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLocaleLowerCase() !== "n" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      openCaptureFromKeyboard();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function captureTask(title: string) {
    const task: Task = {
      id: createId(),
      title,
      status: "inbox",
      estimateMinutes: null,
      personId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    store.dispatch({ type: "task/captured", task });
  }

  function moveTask(taskId: string, status: "today" | "later") {
    store.dispatch({ type: "task/moved", taskId, status });
  }

  function completeTask(taskId: string) {
    store.dispatch({
      type: "task/completed",
      taskId,
      completedAt: new Date().toISOString(),
    });
  }

  function addToTop3(taskId: string) {
    store.dispatch({ type: "top3/added", taskId });
  }

  function openCapture() {
    showCaptureDialog();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-layout">
        <header className="brand-rail">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <div>
              <strong className="brand-name">DayDock</strong>
              <span className="brand-subtitle">Your day, clearly.</span>
            </div>
          </div>

          <nav className="primary-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = surface === item.id;
              const badge =
                item.id === "inbox" && inboxCount > 0
                  ? inboxCount
                  : item.id === "people" && duePeople.length > 0
                    ? duePeople.length
                    : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? "nav-item is-active" : "nav-item"}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSurface(item.id)}
                >
                  <SurfaceIcon surface={item.id} />
                  <span className="nav-copy">
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </span>
                  {badge !== null ? <span className="nav-badge">{badge}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="privacy-note">
            <span className="privacy-dot" aria-hidden="true" />
            <span>
              Local only
              <small>Saved in this browser</small>
            </span>
          </div>
        </header>

        <main id="main-content" className="main-surface">
          <header className="surface-topbar">
            <span>{formatDay(today)}</span>
            <span className="local-badge">Private by default</span>
          </header>

          <div className="surface-content">
            {surface === "today" ? (
              <TodaySurface
                top3={top3}
                todayTasks={todayTasks}
                onAddToTop3={addToTop3}
                onComplete={completeTask}
              />
            ) : null}
            {surface === "inbox" ? (
              <InboxSurface
                tasks={inboxTasks}
                onMoveToday={(taskId) => moveTask(taskId, "today")}
                onMoveLater={(taskId) => moveTask(taskId, "later")}
                onComplete={completeTask}
              />
            ) : null}
            {surface === "people" ? <PeopleSurface duePeople={duePeople} /> : null}
            {surface === "review" ? (
              <ReviewSurface completedCount={completedTasks.length} />
            ) : null}
          </div>
        </main>
      </div>

      <button
        type="button"
        className="quick-capture-trigger"
        aria-label="Quick capture"
        onClick={openCapture}
      >
        <span className="capture-plus" aria-hidden="true">+</span>
        <span className="capture-trigger-copy">Capture</span>
        <kbd>N</kbd>
      </button>

      <QuickCaptureDialog
        dialogRef={captureDialogRef}
        onCapture={captureTask}
      />
    </div>
  );
}
