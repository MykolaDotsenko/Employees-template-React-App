import { DEFAULT_EMPLOYEES, type Employee } from "../domain/employee";

const LEGACY_STORAGE_KEY = "employees";

function isEmployee(value: unknown): value is Employee {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    (typeof candidate.id === "number" || typeof candidate.id === "string") &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    (typeof candidate.salary === "number" || typeof candidate.salary === "string") &&
    typeof candidate.increase === "boolean" &&
    typeof candidate.rise === "boolean"
  );
}

function normalizeEmployee(employee: Employee | (Omit<Employee, "id" | "salary"> & { id: number; salary: string })): Employee | null {
  const salary =
    typeof employee.salary === "number" ? employee.salary : Number.parseFloat(employee.salary);

  if (!Number.isFinite(salary) || salary < 0) return null;

  return {
    id: String(employee.id),
    name: employee.name.trim(),
    salary,
    increase: employee.increase,
    rise: employee.rise,
  };
}

export function loadEmployees(storage: Storage = window.localStorage): Employee[] {
  try {
    const raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));

    const employees = parsed
      .filter(isEmployee)
      .map((employee) => normalizeEmployee(employee))
      .filter((employee): employee is Employee => employee !== null);

    return employees.length > 0
      ? employees
      : DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));
  } catch {
    return DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));
  }
}

export function saveEmployees(
  employees: readonly Employee[],
  storage: Storage = window.localStorage,
): void {
  try {
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(employees));
  } catch {
    // Persistence is best-effort during the migration bridge.
    // DayDock's versioned storage layer replaces this adapter in PR3.
  }
}
