import type {
  ActiveFocusSession,
  CalendarBusyEvent,
  DayPlan,
  FocusOutcome,
  NonDoneTaskStatus,
  Person,
  Task,
  TaskRecurrence,
} from "./model";

export type DayDockAction =
  | {
      type: "calendar/replaced";
      events: CalendarBusyEvent[];
      importedAt: string;
      sourceLabel: string;
    }
  | { type: "calendar/cleared" }
  | { type: "day/started"; plan: DayPlan }
  | { type: "task/captured"; task: Task }
  | { type: "task/renamed"; taskId: string; title: string }
  | { type: "task/removed"; taskId: string }
  | { type: "task/moved"; taskId: string; status: NonDoneTaskStatus }
  | {
      type: "task/deferred";
      taskId: string;
      deferUntil: string | null;
      recurrence: TaskRecurrence | null;
    }
  | { type: "task/resurfaceDue"; dateKey: string }
  | { type: "task/completed"; taskId: string; completedAt: string }
  | {
      type: "task/completedWithNext";
      taskId: string;
      completedAt: string;
      nextTask: Task;
    }
  | { type: "task/reopened"; taskId: string; status: NonDoneTaskStatus }
  | { type: "task/personAttached"; taskId: string; personId: string | null }
  | { type: "top3/added"; taskId: string }
  | { type: "top3/removed"; taskId: string }
  | { type: "person/added"; person: Person }
  | { type: "person/renamed"; personId: string; name: string }
  | { type: "person/removed"; personId: string }
  | {
      type: "person/followUpChanged";
      personId: string;
      nextFollowUpDate: string | null;
    }
  | { type: "person/contextChanged"; personId: string; context: string }
  | { type: "focus/started"; session: ActiveFocusSession }
  | { type: "focus/paused"; pausedAt: string }
  | { type: "focus/resumed"; resumedAt: string }
  | { type: "focus/finished"; endedAt: string; outcome: FocusOutcome };
