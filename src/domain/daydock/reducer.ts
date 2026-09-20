import type { DayDockAction } from "./actions";
import {
  MAX_FOCUS_DURATION_MINUTES,
  MIN_FOCUS_DURATION_MINUTES,
} from "./focus";
import type {
  ActiveFocusSession,
  DayDockState,
  FocusOutcome,
  FocusSessionRecord,
  Person,
  Task,
} from "./model";

function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter((candidate) => candidate !== id);
}

function isDateKey(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updatePerson(
  state: DayDockState,
  personId: string,
  update: (person: Person) => Person,
): DayDockState {
  const current = state.people[personId];
  if (!current) return state;

  const nextPerson = update(current);
  if (nextPerson === current) return state;

  return {
    ...state,
    people: {
      ...state.people,
      [personId]: nextPerson,
    },
  };
}

function updateTask(
  state: DayDockState,
  taskId: string,
  update: (task: Task) => Task,
): DayDockState {
  const current = state.tasks[taskId];
  if (!current) return state;

  const nextTask = update(current);
  if (nextTask === current) return state;

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: nextTask,
    },
  };
}

function finishFocusSession(
  session: ActiveFocusSession,
  endedAt: string,
  outcome: FocusOutcome,
): FocusSessionRecord {
  const trailingPauseMs =
    session.pausedAt === null
      ? 0
      : Math.max(0, parseTime(endedAt) - parseTime(session.pausedAt));

  return {
    ...session,
    pausedAt: null,
    accumulatedPauseMs: session.accumulatedPauseMs + trailingPauseMs,
    endedAt,
    outcome,
  };
}

export function dayDockReducer(
  state: DayDockState,
  action: DayDockAction,
): DayDockState {
  switch (action.type) {
    case "task/captured": {
      const title = action.task.title.trim();
      if (!title || state.tasks[action.task.id]) return state;

      const task: Task = {
        ...action.task,
        title,
      };

      return {
        ...state,
        tasks: {
          ...state.tasks,
          [task.id]: task,
        },
        taskOrder: [...state.taskOrder, task.id],
      };
    }

    case "task/renamed": {
      const title = action.title.trim();
      if (!title) return state;

      return updateTask(state, action.taskId, (task) =>
        task.title === title ? task : { ...task, title },
      );
    }

    case "task/removed": {
      const current = state.tasks[action.taskId];
      if (
        !current ||
        current.status === "done" ||
        state.focus.active?.taskId === action.taskId
      ) {
        return state;
      }

      const tasks = { ...state.tasks };
      delete tasks[action.taskId];

      return {
        ...state,
        tasks,
        taskOrder: removeId(state.taskOrder, action.taskId),
        top3: removeId(state.top3, action.taskId),
        focus: {
          ...state.focus,
          history: state.focus.history.filter(
            (session) => session.taskId !== action.taskId,
          ),
        },
      };
    }

    case "task/moved": {
      const current = state.tasks[action.taskId];
      if (
        !current ||
        current.status === "done" ||
        state.focus.active?.taskId === action.taskId
      ) {
        return state;
      }

      const nextState = updateTask(state, action.taskId, (task) =>
        task.status === action.status ? task : { ...task, status: action.status },
      );

      if (nextState === state || action.status === "today") return nextState;

      return {
        ...nextState,
        top3: removeId(nextState.top3, action.taskId),
      };
    }

    case "task/completed": {
      const current = state.tasks[action.taskId];
      if (!current || current.status === "done") return state;

      const nextState = updateTask(state, action.taskId, (task) => ({
        ...task,
        status: "done",
        completedAt: action.completedAt,
      }));

      const activeFocus = nextState.focus.active;
      const shouldFinishFocus = activeFocus?.taskId === action.taskId;

      return {
        ...nextState,
        top3: removeId(nextState.top3, action.taskId),
        focus: shouldFinishFocus
          ? {
              active: null,
              history: [
                ...nextState.focus.history,
                finishFocusSession(activeFocus, action.completedAt, "completed"),
              ],
            }
          : nextState.focus,
      };
    }

    case "task/reopened": {
      const current = state.tasks[action.taskId];
      if (!current || current.status !== "done") return state;

      return updateTask(state, action.taskId, (task) => ({
        ...task,
        status: action.status,
        completedAt: null,
      }));
    }

    case "task/personAttached": {
      const current = state.tasks[action.taskId];
      if (!current) return state;

      if (action.personId !== null && !state.people[action.personId]) return state;
      if (current.personId === action.personId) return state;

      return updateTask(state, action.taskId, (task) => ({
        ...task,
        personId: action.personId,
      }));
    }

    case "top3/added": {
      const task = state.tasks[action.taskId];

      if (
        !task ||
        task.status !== "today" ||
        state.top3.includes(action.taskId) ||
        state.top3.length >= 3
      ) {
        return state;
      }

      return {
        ...state,
        top3: [...state.top3, action.taskId],
      };
    }

    case "top3/removed": {
      if (!state.top3.includes(action.taskId)) return state;

      return {
        ...state,
        top3: removeId(state.top3, action.taskId),
      };
    }

    case "person/added": {
      const name = action.person.name.trim();
      const context = action.person.context.trim();

      if (
        !name ||
        name.length > 120 ||
        context.length > 2_000 ||
        !isDateKey(action.person.nextFollowUpDate) ||
        state.people[action.person.id]
      ) {
        return state;
      }

      return {
        ...state,
        people: {
          ...state.people,
          [action.person.id]: {
            ...action.person,
            name,
            context,
          },
        },
        personOrder: [...state.personOrder, action.person.id],
      };
    }

    case "person/followUpChanged": {
      if (!isDateKey(action.nextFollowUpDate)) return state;

      return updatePerson(state, action.personId, (person) =>
        person.nextFollowUpDate === action.nextFollowUpDate
          ? person
          : { ...person, nextFollowUpDate: action.nextFollowUpDate },
      );
    }

    case "person/contextChanged": {
      const context = action.context.trim();
      if (context.length > 2_000) return state;

      return updatePerson(state, action.personId, (person) =>
        person.context === context ? person : { ...person, context },
      );
    }

    case "focus/started": {
      const task = state.tasks[action.session.taskId];

      if (
        state.focus.active !== null ||
        !task ||
        task.status !== "today" ||
        action.session.durationMinutes < MIN_FOCUS_DURATION_MINUTES ||
        action.session.durationMinutes > MAX_FOCUS_DURATION_MINUTES ||
        action.session.accumulatedPauseMs !== 0 ||
        action.session.pausedAt !== null
      ) {
        return state;
      }

      return {
        ...state,
        focus: {
          ...state.focus,
          active: action.session,
        },
      };
    }

    case "focus/paused": {
      const active = state.focus.active;
      if (active === null || active.pausedAt !== null) return state;

      return {
        ...state,
        focus: {
          ...state.focus,
          active: {
            ...active,
            pausedAt: action.pausedAt,
          },
        },
      };
    }

    case "focus/resumed": {
      const active = state.focus.active;
      if (active === null || active.pausedAt === null) return state;

      const pauseMs = Math.max(
        0,
        parseTime(action.resumedAt) - parseTime(active.pausedAt),
      );

      return {
        ...state,
        focus: {
          ...state.focus,
          active: {
            ...active,
            pausedAt: null,
            accumulatedPauseMs: active.accumulatedPauseMs + pauseMs,
          },
        },
      };
    }

    case "focus/finished": {
      const active = state.focus.active;
      if (active === null) return state;

      return {
        ...state,
        focus: {
          active: null,
          history: [
            ...state.focus.history,
            finishFocusSession(active, action.endedAt, action.outcome),
          ],
        },
      };
    }
  }
}
