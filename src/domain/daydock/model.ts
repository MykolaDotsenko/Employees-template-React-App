export type NonDoneTaskStatus = "inbox" | "today" | "later";
export type TaskStatus = NonDoneTaskStatus | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  estimateMinutes: number | null;
  personId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Person {
  id: string;
  name: string;
  context: string;
  nextFollowUpDate: string | null;
  createdAt: string;
}

export interface DayDockState {
  tasks: Record<string, Task>;
  taskOrder: string[];
  top3: string[];
  people: Record<string, Person>;
  personOrder: string[];
}

export function createInitialDayDockState(): DayDockState {
  return {
    tasks: {},
    taskOrder: [],
    top3: [],
    people: {},
    personOrder: [],
  };
}
