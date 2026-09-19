import type { DayDockAction } from "./actions";
import type { DayDockState, Task } from "./model";

function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter((candidate) => candidate !== id);
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

    case "task/moved": {
      const current = state.tasks[action.taskId];
      if (!current || current.status === "done") return state;

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

      return {
        ...nextState,
        top3: removeId(nextState.top3, action.taskId),
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
      if (!name || state.people[action.person.id]) return state;

      return {
        ...state,
        people: {
          ...state.people,
          [action.person.id]: {
            ...action.person,
            name,
            context: action.person.context.trim(),
          },
        },
        personOrder: [...state.personOrder, action.person.id],
      };
    }
  }
}
