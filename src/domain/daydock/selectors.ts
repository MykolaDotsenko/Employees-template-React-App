import type { DayDockState, Person, Task, TaskStatus } from "./model";

export function selectTasksByStatus(
  state: DayDockState,
  status: TaskStatus,
): Task[] {
  return state.taskOrder.flatMap((taskId) => {
    const task = state.tasks[taskId];
    return task?.status === status ? [task] : [];
  });
}

export function selectTop3(state: DayDockState): Task[] {
  return state.top3.flatMap((taskId) => {
    const task = state.tasks[taskId];
    return task?.status === "today" ? [task] : [];
  });
}

export function selectInboxCount(state: DayDockState): number {
  return selectTasksByStatus(state, "inbox").length;
}

export function selectPeople(state: DayDockState): Person[] {
  return state.personOrder.flatMap((personId) => {
    const person = state.people[personId];
    return person ? [person] : [];
  });
}

export function selectOpenTasksForPerson(
  state: DayDockState,
  personId: string,
): Task[] {
  return state.taskOrder.flatMap((taskId) => {
    const task = state.tasks[taskId];

    return task && task.personId === personId && task.status !== "done"
      ? [task]
      : [];
  });
}

export function selectFollowUpsDue(
  state: DayDockState,
  isoDate: string,
): Person[] {
  return state.personOrder.flatMap((personId) => {
    const person = state.people[personId];

    if (
      !person ||
      person.nextFollowUpDate === null ||
      person.nextFollowUpDate > isoDate
    ) {
      return [];
    }

    return [person];
  });
}


export interface ReviewSnapshot {
  completedTasks: Task[];
  focusSessions: DayDockState["focus"]["history"];
  focusMs: number;
  openTodayTasks: Task[];
  inboxCount: number;
  duePeopleCount: number;
}

export interface ReviewWindow {
  startMs: number;
  endMs: number;
  todayKey: string;
}

function isTimestampInWindow(
  value: string | null,
  startMs: number,
  endMs: number,
): boolean {
  if (value === null) return false;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= startMs && timestamp < endMs;
}

export function selectReviewSnapshot(
  state: DayDockState,
  window: ReviewWindow,
): ReviewSnapshot {
  const completedTasks = state.taskOrder.flatMap((taskId) => {
    const task = state.tasks[taskId];

    return task?.status === "done" &&
      isTimestampInWindow(task.completedAt, window.startMs, window.endMs)
      ? [task]
      : [];
  });

  const focusSessions = state.focus.history.filter((session) =>
    isTimestampInWindow(session.endedAt, window.startMs, window.endMs),
  );

  const focusMs = focusSessions.reduce((total, session) => {
    const startedAt = Date.parse(session.startedAt);
    const endedAt = Date.parse(session.endedAt);

    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
      return total;
    }

    return (
      total +
      Math.max(0, endedAt - startedAt - session.accumulatedPauseMs)
    );
  }, 0);

  return {
    completedTasks,
    focusSessions,
    focusMs,
    openTodayTasks: selectTasksByStatus(state, "today"),
    inboxCount: selectInboxCount(state),
    duePeopleCount: selectFollowUpsDue(state, window.todayKey).length,
  };
}
