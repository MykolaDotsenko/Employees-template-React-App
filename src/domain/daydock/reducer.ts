import type { DayDockAction } from "./actions";
import {
  MAX_FOCUS_DURATION_MINUTES,
  MIN_FOCUS_DURATION_MINUTES,
} from "./focus";
import { isDateKey } from "./scheduling";
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

function completeTaskState(
  state: DayDockState,
  taskId: string,
  completedAt: string,
): DayDockState {
  const current = state.tasks[taskId];
  if (!current || current.status === "done") return state;

  const nextState = updateTask(state, taskId, (task) => ({
    ...task,
    status: "done",
    deferUntil: null,
    recurrence: null,
    completedAt,
  }));

  const activeFocus = nextState.focus.active;
  const shouldFinishFocus = activeFocus?.taskId === taskId;

  return {
    ...nextState,
    top3: removeId(nextState.top3, taskId),
    focus: shouldFinishFocus
      ? {
          active: null,
          history: [
            ...nextState.focus.history,
            finishFocusSession(activeFocus, completedAt, "completed"),
          ],
        }
      : nextState.focus,
  };
}

export function dayDockReducer(
  state: DayDockState,
  action: DayDockAction,
): DayDockState {
  switch (action.type) {
    case "workday/changed": {
      const { startHour, endHour } = action;

      if (
        !Number.isInteger(startHour) ||
        !Number.isInteger(endHour) ||
        startHour < 0 ||
        startHour > 23 ||
        endHour < 1 ||
        endHour > 24 ||
        startHour >= endHour
      ) {
        return state;
      }

      if (
        state.workday.startHour === startHour &&
        state.workday.endHour === endHour
      ) {
        return state;
      }

      return {
        ...state,
        workday: {
          startHour,
          endHour,
        },
      };
    }

    case "calendar/replaced": {
      if (
        action.events.length > 1_500 ||
        action.sourceLabel.trim().length === 0 ||
        action.sourceLabel.length > 180 ||
        parseTime(action.importedAt) <= 0
      ) {
        return state;
      }

      const seen = new Set<string>();
      const events = [];

      for (const event of action.events) {
        const start = parseTime(event.startAt);
        const end = parseTime(event.endAt);
        const title = event.title.trim();

        if (
          !event.id ||
          seen.has(event.id) ||
          !title ||
          title.length > 280 ||
          start <= 0 ||
          end <= start ||
          event.source !== "ics"
        ) {
          return state;
        }

        seen.add(event.id);
        events.push({ ...event, title });
      }

      events.sort(
        (left, right) =>
          parseTime(left.startAt) - parseTime(right.startAt) ||
          left.title.localeCompare(right.title),
      );

      return {
        ...state,
        calendar: {
          events,
          importedAt: action.importedAt,
          sourceLabel: action.sourceLabel.trim(),
        },
      };
    }

    case "calendar/cleared":
      return state.calendar.events.length === 0 &&
        state.calendar.importedAt === null &&
        state.calendar.sourceLabel === null
        ? state
        : {
            ...state,
            calendar: {
              events: [],
              importedAt: null,
              sourceLabel: null,
            },
          };

    case "notifications/readyAgainChanged":
      return state.notifications.readyAgain === action.enabled
        ? state
        : {
            ...state,
            notifications: {
              ...state.notifications,
              readyAgain: action.enabled,
            },
          };

    case "notifications/readyAgainNotified":
      if (
        !state.notifications.readyAgain ||
        !isDateKey(action.dateKey) ||
        state.notifications.lastReadyAgainNotifiedDate === action.dateKey
      ) {
        return state;
      }

      return {
        ...state,
        notifications: {
          ...state.notifications,
          lastReadyAgainNotifiedDate: action.dateKey,
        },
      };

    case "day/started": {
      const { plan } = action;

      if (
        !isDateKey(plan.dateKey) ||
        !Number.isInteger(plan.focusRoomMinutes) ||
        plan.focusRoomMinutes < 30 ||
        plan.focusRoomMinutes > 480 ||
        parseTime(plan.startedAt) <= 0
      ) {
        return state;
      }

      if (
        state.dayPlan?.dateKey === plan.dateKey &&
        state.dayPlan.focusRoomMinutes === plan.focusRoomMinutes &&
        state.dayPlan.startedAt === plan.startedAt
      ) {
        return state;
      }

      return { ...state, dayPlan: plan };
    }

    case "task/captured": {
      const title = action.task.title.trim();
      if (!title || state.tasks[action.task.id]) return state;

      if (
        !isDateKey(action.task.deferUntil) ||
        (action.task.recurrence !== null &&
          !isDateKey(action.task.recurrence.anchorDate)) ||
        (action.task.status === "later" &&
          action.task.recurrence !== null &&
          action.task.deferUntil === null) ||
        (action.task.status === "done" &&
          (action.task.deferUntil !== null || action.task.recurrence !== null))
      ) {
        return state;
      }

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

      const nextState = updateTask(state, action.taskId, (task) => {
        const nextRecurrence =
          action.status === "later" ? null : task.recurrence;

        if (
          task.status === action.status &&
          task.deferUntil === null &&
          task.recurrence === nextRecurrence
        ) {
          return task;
        }

        return {
          ...task,
          status: action.status,
          deferUntil: null,
          recurrence: nextRecurrence,
        };
      });

      if (nextState === state || action.status === "today") return nextState;

      return {
        ...nextState,
        top3: removeId(nextState.top3, action.taskId),
      };
    }

    case "task/deferred": {
      const current = state.tasks[action.taskId];

      if (
        !current ||
        current.status === "done" ||
        state.focus.active?.taskId === action.taskId ||
        !isDateKey(action.deferUntil) ||
        (action.recurrence !== null &&
          (action.deferUntil === null ||
            !isDateKey(action.recurrence.anchorDate)))
      ) {
        return state;
      }

      const nextState = updateTask(state, action.taskId, (task) => ({
        ...task,
        status: "later",
        deferUntil: action.deferUntil,
        recurrence: action.recurrence,
      }));

      return {
        ...nextState,
        top3: removeId(nextState.top3, action.taskId),
      };
    }

    case "task/resurfaceDue": {
      if (!isDateKey(action.dateKey)) return state;

      let tasks = state.tasks;
      let changed = false;

      for (const taskId of state.taskOrder) {
        const task = tasks[taskId];

        if (
          !task ||
          task.status !== "later" ||
          task.deferUntil === null ||
          task.deferUntil > action.dateKey
        ) {
          continue;
        }

        if (!changed) {
          tasks = { ...state.tasks };
          changed = true;
        }

        tasks[taskId] = {
          ...task,
          status: "inbox",
        };
      }

      return changed ? { ...state, tasks } : state;
    }

    case "task/completed": {
      const current = state.tasks[action.taskId];
      if (!current || current.status === "done" || current.recurrence !== null) {
        return state;
      }

      return completeTaskState(state, action.taskId, action.completedAt);
    }

    case "task/completedWithNext": {
      const current = state.tasks[action.taskId];
      const nextTask = action.nextTask;

      if (
        !current ||
        current.status === "done" ||
        current.recurrence === null ||
        state.tasks[nextTask.id] ||
        nextTask.status !== "later" ||
        nextTask.completedAt !== null ||
        nextTask.deferUntil === null ||
        nextTask.recurrence === null ||
        !nextTask.title.trim() ||
        !isDateKey(nextTask.deferUntil) ||
        !isDateKey(nextTask.recurrence.anchorDate) ||
        nextTask.recurrence.kind !== current.recurrence.kind ||
        nextTask.recurrence.anchorDate !== current.recurrence.anchorDate ||
        (nextTask.personId !== null && !state.people[nextTask.personId])
      ) {
        return state;
      }

      const completedState = completeTaskState(
        state,
        action.taskId,
        action.completedAt,
      );

      return {
        ...completedState,
        tasks: {
          ...completedState.tasks,
          [nextTask.id]: {
            ...nextTask,
            title: nextTask.title.trim(),
          },
        },
        taskOrder: [...completedState.taskOrder, nextTask.id],
      };
    }

    case "task/reopened": {
      const current = state.tasks[action.taskId];
      if (!current || current.status !== "done") return state;

      return updateTask(state, action.taskId, (task) => ({
        ...task,
        status: action.status,
        deferUntil: null,
        recurrence: null,
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

    case "person/renamed": {
      const name = action.name.trim();
      if (!name || name.length > 120) return state;

      return updatePerson(state, action.personId, (person) =>
        person.name === name ? person : { ...person, name },
      );
    }

    case "person/removed": {
      if (!state.people[action.personId]) return state;

      const people = { ...state.people };
      delete people[action.personId];

      let tasks = state.tasks;

      for (const taskId of state.taskOrder) {
        const task = tasks[taskId];
        if (!task || task.personId !== action.personId) continue;

        if (tasks === state.tasks) tasks = { ...state.tasks };
        tasks[taskId] = { ...task, personId: null };
      }

      return {
        ...state,
        people,
        personOrder: removeId(state.personOrder, action.personId),
        tasks,
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
