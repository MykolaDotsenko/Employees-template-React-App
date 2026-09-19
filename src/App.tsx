import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActiveFocusSession, Person, Task } from "./domain/daydock/model";
import {
  selectFollowUpsDue,
  selectInboxCount,
  selectOpenTasksForPerson,
  selectPeople,
  selectTasksByStatus,
  selectTop3,
} from "./domain/daydock/selectors";
import {
  CommandPalette,
  type PaletteSurface,
} from "./features/command-palette/CommandPalette";
import { FocusMode } from "./features/focus/FocusMode";
import { InboxSurface } from "./features/inbox/InboxSurface";
import { PeopleSurface } from "./features/people/PeopleSurface";
import { QuickCaptureDialog } from "./features/quick-capture/QuickCaptureDialog";
import { TodaySurface } from "./features/today/TodaySurface";
import { dayDockStore } from "./store/browserDayDockStore";
import type { DayDockStore } from "./store/dayDockStore";
import { useDayDockState } from "./store/useDayDockState";

type Surface = PaletteSurface;

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

function createId(prefix = "task"): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  const commandDialogRef = useRef<HTMLDialogElement>(null);
  const state = useDayDockState(store);

  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const top3 = selectTop3(state);
  const todayTasks = selectTasksByStatus(state, "today");
  const inboxTasks = selectTasksByStatus(state, "inbox");
  const completedTasks = selectTasksByStatus(state, "done");
  const people = selectPeople(state);
  const duePeople = selectFollowUpsDue(state, todayKey);
  const tasksByPerson = Object.fromEntries(
    people.map((person) => [
      person.id,
      selectOpenTasksForPerson(state, person.id),
    ]),
  );
  const inboxCount = selectInboxCount(state);
  const allTasks = state.taskOrder.flatMap((taskId) => {
    const task = state.tasks[taskId];
    return task ? [task] : [];
  });
  const currentTask = top3[0] ?? null;

  const activeFocus = state.focus.active;
  const focusedTask =
    activeFocus === null ? null : state.tasks[activeFocus.taskId] ?? null;

  function showCaptureDialog() {
    const dialog = captureDialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    dialog.querySelector<HTMLTextAreaElement>("[data-capture-input]")?.focus();
  }

  function showCommandPalette() {
    const dialog = commandDialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("[data-command-input]")?.focus();
  }

  const openCaptureFromKeyboard = useEffectEvent(() => {
    showCaptureDialog();
  });

  const openCommandsFromKeyboard = useEffectEvent(() => {
    showCommandPalette();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (activeFocus !== null) return;

      const key = event.key.toLocaleLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCommandsFromKeyboard();
        return;
      }

      if (
        key !== "n" ||
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
  }, [activeFocus]);

  function captureTask(title: string) {
    const task: Task = {
      id: createId("task"),
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

  function addPerson(
    name: string,
    context: string,
    nextFollowUpDate: string | null,
  ) {
    const person: Person = {
      id: createId("person"),
      name,
      context,
      nextFollowUpDate,
      createdAt: new Date().toISOString(),
    };

    store.dispatch({ type: "person/added", person });
  }

  function setPersonFollowUp(
    personId: string,
    nextFollowUpDate: string | null,
  ) {
    store.dispatch({
      type: "person/followUpChanged",
      personId,
      nextFollowUpDate,
    });
  }

  function addPersonFollowUpTask(personId: string, title: string) {
    const task: Task = {
      id: createId("task"),
      title,
      status: "inbox",
      estimateMinutes: null,
      personId,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    store.dispatch({ type: "task/captured", task });
  }

  function startFocus(taskId: string) {
    const task = state.tasks[taskId];
    if (!task || task.status !== "today" || state.focus.active !== null) return;

    const session: ActiveFocusSession = {
      id: createId("focus"),
      taskId,
      startedAt: new Date().toISOString(),
      durationMinutes: task.estimateMinutes ?? 50,
      pausedAt: null,
      accumulatedPauseMs: 0,
    };

    store.dispatch({ type: "focus/started", session });
  }

  function pauseFocus() {
    store.dispatch({
      type: "focus/paused",
      pausedAt: new Date().toISOString(),
    });
  }

  function resumeFocus() {
    store.dispatch({
      type: "focus/resumed",
      resumedAt: new Date().toISOString(),
    });
  }

  function stopFocus() {
    store.dispatch({
      type: "focus/finished",
      endedAt: new Date().toISOString(),
      outcome: "stopped",
    });
  }

  function completeFocusedTask() {
    if (activeFocus === null) return;
    completeTask(activeFocus.taskId);
  }

  function openCapture() {
    showCaptureDialog();
  }

  function openCommands() {
    showCommandPalette();
  }

  function navigateFromPalette(nextSurface: PaletteSurface) {
    setSurface(nextSurface);
  }

  if (activeFocus !== null && focusedTask !== null) {
    return (
      <FocusMode
        session={activeFocus}
        task={focusedTask}
        onPause={pauseFocus}
        onResume={resumeFocus}
        onStop={stopFocus}
        onComplete={completeFocusedTask}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-layout">
        <header className="brand-rail">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">D</span>
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
            <div className="topbar-actions">
              <button
                type="button"
                className="command-trigger"
                aria-label="Open command palette"
                onClick={openCommands}
              >
                <span>Search</span>
                <kbd>⌘K</kbd>
              </button>
              <span className="local-badge">Private by default</span>
            </div>
          </header>

          <div className="surface-content">
            {surface === "today" ? (
              <TodaySurface
                top3={top3}
                todayTasks={todayTasks}
                onAddToTop3={addToTop3}
                onComplete={completeTask}
                onStartFocus={startFocus}
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
            {surface === "people" ? (
              <PeopleSurface
                people={people}
                tasksByPerson={tasksByPerson}
                todayKey={todayKey}
                onAddPerson={addPerson}
                onSetFollowUp={setPersonFollowUp}
                onAddFollowUpTask={addPersonFollowUpTask}
              />
            ) : null}
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

      <CommandPalette
        dialogRef={commandDialogRef}
        tasks={allTasks}
        people={people}
        currentTask={currentTask}
        onNavigate={navigateFromPalette}
        onQuickCapture={showCaptureDialog}
        onStartFocus={startFocus}
      />
    </div>
  );
}
