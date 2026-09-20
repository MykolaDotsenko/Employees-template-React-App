export type NonDoneTaskStatus = "inbox" | "today" | "later";
export type TaskStatus = NonDoneTaskStatus | "done";
export type TaskRecurrenceKind = "daily" | "weekdays" | "weekly" | "monthly";

export interface TaskRecurrence {
  kind: TaskRecurrenceKind;
  anchorDate: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  estimateMinutes: number | null;
  personId: string | null;
  deferUntil: string | null;
  recurrence: TaskRecurrence | null;
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

export interface DayPlan {
  dateKey: string;
  focusRoomMinutes: number;
  startedAt: string;
}

export interface CalendarBusyEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  source: "ics";
}

export interface CalendarState {
  events: CalendarBusyEvent[];
  importedAt: string | null;
  sourceLabel: string | null;
}

export interface DayDockState {
  tasks: Record<string, Task>;
  taskOrder: string[];
  top3: string[];
  people: Record<string, Person>;
  personOrder: string[];
  focus: FocusState;
  dayPlan: DayPlan | null;
  calendar: CalendarState;
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
    dayPlan: null,
    calendar: {
      events: [],
      importedAt: null,
      sourceLabel: null,
    },
  };
}
