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
