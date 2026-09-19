import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  matchesFilter,
  matchesSearch,
  type Employee,
  type EmployeeFilter,
} from "../../domain/employee";
import { loadEmployees, saveEmployees } from "../../storage/employeeStorage";

const FILTERS: readonly { value: EmployeeFilter; label: string }[] = [
  { value: "all", label: "All employees" },
  { value: "promotion", label: "Up for promotion" },
  { value: "salary", label: "Salary above €3,300" },
];

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `employee-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function LegacyEmployeesApp() {
  const [employees, setEmployees] = useState<Employee[]>(loadEmployees);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EmployeeFilter>("all");
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");

  useEffect(() => {
    saveEmployees(employees);
  }, [employees]);

  const visibleEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => matchesSearch(employee, query) && matchesFilter(employee, filter),
      ),
    [employees, filter, query],
  );

  const promotedCount = employees.filter((employee) => employee.increase).length;

  function toggleEmployee(id: string, property: "increase" | "rise") {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === id ? { ...employee, [property]: !employee[property] } : employee,
      ),
    );
  }

  function deleteEmployee(id: string) {
    setEmployees((current) => current.filter((employee) => employee.id !== id));
  }

  function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedSalary = Number.parseFloat(salary);
    const trimmedName = name.trim();

    if (!trimmedName || !Number.isFinite(parsedSalary) || parsedSalary < 0) return;

    setEmployees((current) => [
      ...current,
      {
        id: createId(),
        name: trimmedName,
        salary: parsedSalary,
        increase: false,
        rise: false,
      },
    ]);
    setName("");
    setSalary("");
  }

  return (
    <main className="legacy-shell">
      <section className="legacy-panel" aria-labelledby="legacy-title">
        <header className="legacy-header">
          <p className="eyebrow">DayDock · migration bridge</p>
          <h1 id="legacy-title">Employee workspace</h1>
          <p>
            {employees.length} employees · {promotedCount} marked for recognition
          </p>
        </header>

        <div className="legacy-toolbar">
          <label className="search-field">
            <span>Search employees</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Type a name"
            />
          </label>

          <div className="filter-group" aria-label="Employee filters">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={filter === option.value ? "filter-button active" : "filter-button"}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="employee-list" aria-live="polite">
          {visibleEmployees.map((employee) => (
            <li key={employee.id} className="employee-row">
              <button
                type="button"
                className="employee-name"
                aria-pressed={employee.rise}
                onClick={() => toggleEmployee(employee.id, "rise")}
              >
                <span>{employee.name}</span>
                {employee.rise ? <small>Promotion candidate</small> : null}
              </button>

              <span className="salary">€{employee.salary.toLocaleString()}</span>

              <div className="employee-actions">
                <button
                  type="button"
                  aria-pressed={employee.increase}
                  onClick={() => toggleEmployee(employee.id, "increase")}
                >
                  {employee.increase ? "Recognized" : "Recognize"}
                </button>
                <button
                  type="button"
                  className="danger"
                  aria-label={`Delete ${employee.name}`}
                  onClick={() => deleteEmployee(employee.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {visibleEmployees.length === 0 ? (
          <p className="empty-state">No employees match this view.</p>
        ) : null}

        <form className="add-form" onSubmit={addEmployee}>
          <div>
            <p className="eyebrow">Legacy workflow</p>
            <h2>Add employee</h2>
          </div>
          <label>
            <span>Name</span>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            <span>Salary</span>
            <input
              name="salary"
              type="number"
              min="0"
              step="1"
              value={salary}
              onChange={(event) => setSalary(event.currentTarget.value)}
              required
            />
          </label>
          <button type="submit" className="primary-button">
            Add
          </button>
        </form>
      </section>
    </main>
  );
}
