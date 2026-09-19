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

export interface ActiveFocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  durationMinutes: number;
  pausedAt: string | null;
  accumulatedPauseMs: number;
}

export type FocusOutcome = "completed" | "stopped";

export interface FocusSessionRecord extends ActiveFocusSession {
  pausedAt: null;
  endedAt: string;
  outcome: FocusOutcome;
}

export interface FocusState {
  active: ActiveFocusSession | null;
  history: FocusSessionRecord[];
}

export interface DayDockState {
  tasks: Record<string, Task>;
  taskOrder: string[];
  top3: string[];
  people: Record<string, Person>;
  personOrder: string[];
  focus: FocusState;
}

export function createInitialDayDockState(): DayDockState {
  return {
    tasks: {},
    taskOrder: [],
    top3: [],
    people: {},
    personOrder: [],
    focus: {
      active: null,
      history: [],
    },
  };
}
