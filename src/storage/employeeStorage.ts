import { DEFAULT_EMPLOYEES, type Employee } from "../domain/employee";

const LEGACY_STORAGE_KEY = "employees";

interface LegacyEmployeeInput {
  id: string | number;
  name: string;
  salary: string | number;
  increase: boolean;
  rise: boolean;
}

function isLegacyEmployeeInput(value: unknown): value is LegacyEmployeeInput {
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

function normalizeEmployee(employee: LegacyEmployeeInput): Employee | null {
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

function defaults(): Employee[] {
  return DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));
}

export function loadEmployees(storage: Storage = window.localStorage): Employee[] {
  try {
    const raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return defaults();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults();

    const employees = parsed
      .filter(isLegacyEmployeeInput)
      .map(normalizeEmployee)
      .filter((employee): employee is Employee => employee !== null);

    return employees.length > 0 ? employees : defaults();
  } catch {
    return defaults();
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
