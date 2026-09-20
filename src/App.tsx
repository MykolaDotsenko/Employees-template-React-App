import {
  Activity,
  ViewTransition,
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrandMark } from "./components/BrandMark";
import {
  buildCalendarAwareness,
  suggestedFocusRoomMinutes,
} from "./domain/calendar/availability";
import { parseIcsCalendar } from "./domain/calendar/ics";
import { normalizeFocusDurationMinutes } from "./domain/daydock/focus";
import { buildReviewInsights } from "./domain/daydock/insights";
import type {
  ActiveFocusSession,
  DayDockState,
  Person,
  Task,
  TaskRecurrence,
} from "./domain/daydock/model";
import {
  selectFollowUpsDue,
  selectInboxCount,
  selectOpenTasksForPerson,
  selectPeople,
  selectTasksByStatus,
  selectTop3,
} from "./domain/daydock/selectors";
import { nextRecurrenceDateAfter } from "./domain/daydock/scheduling";
import {
  CommandPalette,
  type PaletteSurface,
} from "./features/command-palette/CommandPalette";
import { DataSafetyPopover } from "./features/data-safety/DataSafetyPopover";
import { FocusMode } from "./features/focus/FocusMode";
import { InboxSurface } from "./features/inbox/InboxSurface";
import { PeopleSurface } from "./features/people/PeopleSurface";
import { QuickCaptureDialog } from "./features/quick-capture/QuickCaptureDialog";
import {
  parseCaptureLaunch,
  stripCaptureLaunchFromUrl,
} from "./features/quick-capture/captureLaunch";
import { ReviewSurface } from "./features/review/ReviewSurface";
import { TodaySurface } from "./features/today/TodaySurface";
import { dayDockStore } from "./store/browserDayDockStore";
import type { DayDockStore } from "./store/dayDockStore";
import { useDayDockState } from "./store/useDayDockState";

type Surface = PaletteSurface;

interface AppProps {
  store?: DayDockStore;
}

type NavItem =
  | { id: Surface; label: string; hint: string }
  | { id: "capture"; label: "Capture"; hint: string };

const NAV_ITEMS: readonly NavItem[] = [
  { id: "today", label: "Today", hint: "What matters now" },
  { id: "inbox", label: "Inbox", hint: "Unsorted thoughts" },
  { id: "capture", label: "Capture", hint: "Add quickly" },
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

export function App({ store = dayDockStore }: AppProps) {
  const [surface, setSurface] = useState<Surface>("today");
  const captureDialogRef = useRef<HTMLDialogElement>(null);
  const commandDialogRef = useRef<HTMLDialogElement>(null);
  const captureLaunchHandledRef = useRef(false);
  const [capturePrefill, setCapturePrefill] = useState<string | null>(null);
  const [initialCaptureLaunch] = useState(() =>
    parseCaptureLaunch(window.location.search),
  );
  const state = useDayDockState(store);
  const persistenceStatus = store.getPersistenceStatus();
  const initialFocus = state.focus.active;
  const [presentationMode, setPresentationMode] = useState<"workspace" | "focus">(
    () => (initialFocus === null ? "workspace" : "focus"),
  );
  const [focusSnapshot, setFocusSnapshot] = useState(initialFocus);

  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const todayKey = localDateKey(today);

  useEffect(() => {
    store.dispatch({ type: "task/resurfaceDue", dateKey: todayKey });
  }, [store, todayKey]);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const reviewInsights = buildReviewInsights(state, todayKey, timeZone);
  const calendarAwareness = buildCalendarAwareness(
    state.calendar.events,
    today,
  );
  const calendarFocusSuggestion =
    state.calendar.importedAt === null
      ? null
      : suggestedFocusRoomMinutes(calendarAwareness);
  const top3 = selectTop3(state);
  const todayTasks = selectTasksByStatus(state, "today");
  const inboxTasks = selectTasksByStatus(state, "inbox");
  const laterTasks = selectTasksByStatus(state, "later");
  const readyAgainCount = inboxTasks.filter(
    (task) => task.deferUntil !== null && task.deferUntil <= todayKey,
  ).length;
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
  const hasCompletedTask = state.taskOrder.some(
    (taskId) => state.tasks[taskId]?.status === "done",
  );
  const gettingStartedStage =
    state.focus.history.length === 0 &&
    state.personOrder.length === 0 &&
    top3.length === 0 &&
    !hasCompletedTask
      ? state.taskOrder.length === 0
        ? "capture"
        : todayTasks.length === 0 &&
            inboxTasks.length > 0 &&
            laterTasks.length === 0
          ? "decide"
          : null
      : null;

  const activeFocus = state.focus.active;
  const focusedTask =
    activeFocus === null ? null : state.tasks[activeFocus.taskId] ?? null;

  function showCaptureDialog(prefill: string | null = null) {
    const dialog = captureDialogRef.current;
    if (!dialog || dialog.open) return;

    setCapturePrefill(prefill);
    dialog.showModal();
    window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLTextAreaElement>("[data-capture-input]")?.focus();
    });
  }

  useEffect(() => {
    if (captureLaunchHandledRef.current || initialCaptureLaunch === null) {
      return;
    }

    captureLaunchHandledRef.current = true;
    window.history.replaceState(
      window.history.state,
      "",
      stripCaptureLaunchFromUrl(window.location.href),
    );
    showCaptureDialog(initialCaptureLaunch.prefill);
  }, [initialCaptureLaunch]);

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
      deferUntil: null,
      recurrence: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    store.dispatch({ type: "task/captured", task });
  }

  function moveTask(taskId: string, status: "inbox" | "today" | "later") {
    store.dispatch({ type: "task/moved", taskId, status });
  }

  function completeTask(taskId: string) {
    const task = state.tasks[taskId];
    if (!task || task.status === "done") return;

    const completedAtDate = new Date();
    const completedAt = completedAtDate.toISOString();

    if (task.recurrence !== null) {
      const nextDate = nextRecurrenceDateAfter(
        task.recurrence,
        localDateKey(completedAtDate),
      );
      const nextTask: Task = {
        ...task,
        id: createId("task"),
        status: "later",
        deferUntil: nextDate,
        recurrence: {
          kind: task.recurrence.kind,
          anchorDate: task.recurrence.anchorDate,
        },
        createdAt: completedAt,
        completedAt: null,
      };

      store.dispatch({
        type: "task/completedWithNext",
        taskId,
        completedAt,
        nextTask,
      });
      return;
    }

    store.dispatch({
      type: "task/completed",
      taskId,
      completedAt,
    });
  }

  function scheduleTask(
    taskId: string,
    deferUntil: string | null,
    recurrence: TaskRecurrence | null,
  ) {
    store.dispatch({
      type: "task/deferred",
      taskId,
      deferUntil,
      recurrence,
    });
  }

  function importCalendar(source: string, sourceLabel: string) {
    const result = parseIcsCalendar(source, {
      now: today,
      horizonDays: 45,
    });

    store.dispatch({
      type: "calendar/replaced",
      events: result.events,
      importedAt: new Date().toISOString(),
      sourceLabel,
    });

    return {
      eventCount: result.events.length,
      warnings: result.warnings,
    };
  }

  function clearCalendar() {
    store.dispatch({ type: "calendar/cleared" });
  }

  function startDay(focusRoomMinutes: number) {
    store.dispatch({
      type: "day/started",
      plan: {
        dateKey: todayKey,
        focusRoomMinutes,
        startedAt: new Date().toISOString(),
      },
    });
  }

  function renameTask(taskId: string, title: string) {
    store.dispatch({ type: "task/renamed", taskId, title });
  }

  function removeTask(taskId: string) {
    store.dispatch({ type: "task/removed", taskId });
  }

  function reopenTask(taskId: string) {
    store.dispatch({ type: "task/reopened", taskId, status: "today" });
  }

  function addToTop3(taskId: string) {
    store.dispatch({ type: "top3/added", taskId });
  }

  function removeFromTop3(taskId: string) {
    store.dispatch({ type: "top3/removed", taskId });
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

  function renamePerson(personId: string, name: string) {
    store.dispatch({ type: "person/renamed", personId, name });
  }

  function setPersonContext(personId: string, context: string) {
    store.dispatch({ type: "person/contextChanged", personId, context });
  }

  function removePerson(personId: string) {
    store.dispatch({ type: "person/removed", personId });
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
      deferUntil: null,
      recurrence: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    store.dispatch({ type: "task/captured", task });
  }

  function startFocus(taskId: string, durationMinutes?: number) {
    const task = state.tasks[taskId];
    if (!task || task.status !== "today" || state.focus.active !== null) return;

    const session: ActiveFocusSession = {
      id: createId("focus"),
      taskId,
      startedAt: new Date().toISOString(),
      durationMinutes: normalizeFocusDurationMinutes(
        durationMinutes ?? task.estimateMinutes,
      ),
      pausedAt: null,
      accumulatedPauseMs: 0,
    };

    store.dispatch({ type: "focus/started", session });
    setFocusSnapshot(session);

    startTransition(() => {
      setPresentationMode("focus");
    });
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

  function returnToWorkspace() {
    startTransition(() => {
      setPresentationMode("workspace");
      setFocusSnapshot(null);
    });
  }

  function stopFocus() {
    store.dispatch({
      type: "focus/finished",
      endedAt: new Date().toISOString(),
      outcome: "stopped",
    });
    returnToWorkspace();
  }

  function completeFocusedTask() {
    if (activeFocus === null) return;
    completeTask(activeFocus.taskId);
    returnToWorkspace();
  }

  function restoreWorkspace(restoredState: DayDockState) {
    store.replaceState(restoredState);

    if (restoredState.focus.active !== null) {
      setFocusSnapshot(restoredState.focus.active);

      startTransition(() => {
        setPresentationMode("focus");
      });

      return;
    }

    setFocusSnapshot(null);

    startTransition(() => {
      setPresentationMode("workspace");
      setSurface("today");
    });
  }

  function openCapture() {
    showCaptureDialog();
  }

  function openCommands() {
    showCommandPalette();
  }

  function navigateTo(nextSurface: Surface) {
    startTransition(() => {
      setSurface(nextSurface);
    });
  }

  function navigateFromPalette(nextSurface: PaletteSurface) {
    navigateTo(nextSurface);
  }

  const presentedFocus = activeFocus ?? focusSnapshot;
  const presentedTask =
    presentedFocus === null
      ? null
      : state.tasks[presentedFocus.taskId] ?? focusedTask;

  if (
    presentationMode === "focus" &&
    presentedFocus !== null &&
    presentedTask !== null
  ) {
    return (
      <ViewTransition>
        <FocusMode
          session={presentedFocus}
          task={presentedTask}
          onPause={pauseFocus}
          onResume={resumeFocus}
          onStop={stopFocus}
          onComplete={completeFocusedTask}
        />
      </ViewTransition>
    );
  }

  return (
    <div
      className={
        gettingStartedStage === null
          ? "app-shell"
          : "app-shell is-getting-started"
      }
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-layout">
        <header className="brand-rail">
          <div className="brand-lockup">
            <BrandMark />
            <div>
              <strong className="brand-name">DayDock</strong>
              <span className="brand-subtitle">Make room for what matters.</span>
            </div>
          </div>

          <nav className="primary-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              if (item.id === "capture") {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="nav-item mobile-capture-nav"
                    aria-label="Capture"
                    onClick={openCapture}
                  >
                    <span className="mobile-capture-nav-icon" aria-hidden="true">
                      +
                    </span>
                    <span className="nav-copy">
                      <span>{item.label}</span>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                );
              }

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
                  onClick={() => navigateTo(item.id)}
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

          <div
            className={
              persistenceStatus === "durable"
                ? "privacy-note"
                : "privacy-note is-warning"
            }
            role="status"
            aria-live="polite"
          >
            <span className="privacy-dot" aria-hidden="true" />
            <span>
              {persistenceStatus === "durable"
                ? "Local only"
                : persistenceStatus === "memory"
                  ? "Session only"
                  : "Save problem"}
              <small>
                {persistenceStatus === "durable"
                  ? "Saved in this browser"
                  : persistenceStatus === "memory"
                    ? "Changes may disappear on reload"
                    : "Latest changes may not survive reload"}
              </small>
            </span>
          </div>
        </header>

        <main id="main-content" className="main-surface">
          <header className="surface-topbar">
            <div className="day-context">
              <span className="day-context-kicker">Your workday</span>
              <span>{formatDay(today)}</span>
            </div>
            <div className="topbar-actions">
              <button
                type="button"
                className="command-trigger"
                aria-label="Open command palette"
                onClick={openCommands}
              >
                <span>Search</span>
                <kbd>Ctrl/⌘ K</kbd>
              </button>
              <DataSafetyPopover
                state={state}
                persistenceStatus={persistenceStatus}
                onRestore={restoreWorkspace}
              />
            </div>
          </header>

          <ViewTransition>
            <div className="surface-content">
              <Activity mode={surface === "today" ? "visible" : "hidden"}>
                <TodaySurface
                  top3={top3}
                  todayTasks={todayTasks}
                  gettingStartedStage={gettingStartedStage}
                  todayKey={todayKey}
                  dayPlan={state.dayPlan}
                  readyAgainCount={readyAgainCount}
                  inboxCount={inboxCount}
                  duePeopleCount={duePeople.length}
                  calendar={state.calendar}
                  calendarAwareness={calendarAwareness}
                  suggestedFocusRoomMinutes={calendarFocusSuggestion}
                  onImportCalendar={importCalendar}
                  onClearCalendar={clearCalendar}
                  onCapture={openCapture}
                  onOpenInbox={() => navigateTo("inbox")}
                  onOpenPeople={() => navigateTo("people")}
                  onStartDay={startDay}
                  onAddToTop3={addToTop3}
                  onRemoveFromTop3={removeFromTop3}
                  onComplete={completeTask}
                  onRename={renameTask}
                  onRemove={removeTask}
                  onStartFocus={startFocus}
                />
              </Activity>

              <Activity mode={surface === "inbox" ? "visible" : "hidden"}>
                <InboxSurface
                  inboxTasks={inboxTasks}
                  laterTasks={laterTasks}
                  todayKey={todayKey}
                  onMoveInbox={(taskId) => moveTask(taskId, "inbox")}
                  onMoveToday={(taskId) => moveTask(taskId, "today")}
                  onSchedule={scheduleTask}
                  onComplete={completeTask}
                  onRename={renameTask}
                  onRemove={removeTask}
                />
              </Activity>

              <Activity mode={surface === "people" ? "visible" : "hidden"}>
                <PeopleSurface
                  people={people}
                  tasksByPerson={tasksByPerson}
                  todayKey={todayKey}
                  onAddPerson={addPerson}
                  onRenamePerson={renamePerson}
                  onSetContext={setPersonContext}
                  onSetFollowUp={setPersonFollowUp}
                  onRemovePerson={removePerson}
                  onAddFollowUpTask={addPersonFollowUpTask}
                />
              </Activity>

              <Activity mode={surface === "review" ? "visible" : "hidden"}>
                <ReviewSurface
                  completedToday={reviewInsights.completedToday}
                  openToday={todayTasks}
                  focusMinutesToday={reviewInsights.focusMinutesToday}
                  focusSessionsToday={reviewInsights.focusSessionsToday}
                  week={reviewInsights.week}
                  tasksById={state.tasks}
                  inboxCount={inboxCount}
                  dueFollowUpsCount={duePeople.length}
                  todayKey={todayKey}
                  onSchedule={scheduleTask}
                  onComplete={completeTask}
                  onReopen={reopenTask}
                  onNavigate={navigateFromPalette}
                />
              </Activity>
            </div>
          </ViewTransition>
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
        prefill={capturePrefill}
        onCapture={captureTask}
        onPrefillConsumed={() => setCapturePrefill(null)}
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
