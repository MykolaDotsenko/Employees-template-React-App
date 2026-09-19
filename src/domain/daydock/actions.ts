import type { NonDoneTaskStatus, Person, Task } from "./model";

export type DayDockAction =
  | { type: "task/captured"; task: Task }
  | { type: "task/renamed"; taskId: string; title: string }
  | { type: "task/moved"; taskId: string; status: NonDoneTaskStatus }
  | { type: "task/completed"; taskId: string; completedAt: string }
  | { type: "task/reopened"; taskId: string; status: NonDoneTaskStatus }
  | { type: "task/personAttached"; taskId: string; personId: string | null }
  | { type: "top3/added"; taskId: string }
  | { type: "top3/removed"; taskId: string }
  | { type: "person/added"; person: Person };
