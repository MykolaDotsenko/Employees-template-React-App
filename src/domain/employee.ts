export type EmployeeId = string;

export interface Employee {
  id: EmployeeId;
  name: string;
  salary: number;
  increase: boolean;
  rise: boolean;
}

export type EmployeeFilter = "all" | "promotion" | "salary";

export const DEFAULT_EMPLOYEES: readonly Employee[] = [
  { id: "legacy-1", name: "Mykola", salary: 3500, increase: false, rise: true },
  { id: "legacy-2", name: "Dennis", salary: 3300, increase: true, rise: true },
  { id: "legacy-3", name: "Juan", salary: 3350, increase: false, rise: true },
  { id: "legacy-4", name: "Ping", salary: 3200, increase: false, rise: false },
];

export function matchesSearch(employee: Employee, query: string): boolean {
  return employee.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function matchesFilter(employee: Employee, filter: EmployeeFilter): boolean {
  if (filter === "promotion") return employee.rise;
  if (filter === "salary") return employee.salary > 3300;
  return true;
}
