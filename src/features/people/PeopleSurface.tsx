import {
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Person, Task } from "../../domain/daydock/model";

interface PeopleSurfaceProps {
  people: Person[];
  tasksByPerson: Record<string, Task[]>;
  todayKey: string;
  onAddPerson: (
    name: string,
    context: string,
    nextFollowUpDate: string | null,
  ) => void;
  onRenamePerson: (personId: string, name: string) => void;
  onSetContext: (personId: string, context: string) => void;
  onSetFollowUp: (personId: string, nextFollowUpDate: string | null) => void;
  onRemovePerson: (personId: string) => void;
  onAddFollowUpTask: (personId: string, title: string) => void;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(dateFromKey(value));
}

function followUpLabel(date: string | null, todayKey: string): string {
  if (date === null) return "No follow-up planned";
  if (date < todayKey) return `Needs a new plan · ${formatDate(date)}`;
  if (date === todayKey) return "Follow up today";
  return `Follow up ${formatDate(date)}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function PersonFollowUpForm({
  person,
  onAddFollowUpTask,
}: {
  person: Person;
  onAddFollowUpTask: (personId: string, title: string) => void;
}) {
  const [title, setTitle] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAddFollowUpTask(person.id, trimmedTitle);
    setTitle("");
  }

  return (
    <form
      className="person-follow-up-form"
      aria-label={`Add follow-up for ${person.name}`}
      onSubmit={submit}
    >
      <label>
        <span className="sr-only">Follow-up task for {person.name}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="Add a follow-up…"
          maxLength={280}
        />
      </label>
      <button type="submit" disabled={!title.trim()}>
        Add
      </button>
    </form>
  );
}

export function PeopleSurface({
  people,
  tasksByPerson,
  todayKey,
  onAddPerson,
  onRenamePerson,
  onSetContext,
  onSetFollowUp,
  onRemovePerson,
  onAddFollowUpTask,
}: PeopleSurfaceProps) {
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const addTitleId = useId();
  const editTitleId = useId();
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [date, setDate] = useState("");
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContext, setEditContext] = useState("");
  const [editDate, setEditDate] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const orderedPeople = [...people].sort((left, right) => {
    const leftDate = left.nextFollowUpDate ?? "9999-12-31";
    const rightDate = right.nextFollowUpDate ?? "9999-12-31";

    return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name);
  });

  const editingPerson =
    editingPersonId === null
      ? null
      : people.find((person) => person.id === editingPersonId) ?? null;

  function openAddDialog() {
    const dialog = addDialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("[data-person-name]")?.focus();
  }

  function closeAddDialog() {
    addDialogRef.current?.close();
  }

  function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    onAddPerson(trimmedName, context.trim(), date || null);
    setName("");
    setContext("");
    setDate("");
    closeAddDialog();
  }

  function openEditDialog(person: Person) {
    const dialog = editDialogRef.current;
    if (!dialog || dialog.open) return;

    setEditingPersonId(person.id);
    setEditName(person.name);
    setEditContext(person.context);
    setEditDate(person.nextFollowUpDate ?? "");
    setConfirmingRemove(false);
    dialog.showModal();
  }

  function resetEditDialog() {
    setEditingPersonId(null);
    setEditName("");
    setEditContext("");
    setEditDate("");
    setConfirmingRemove(false);
  }

  function closeEditDialog() {
    editDialogRef.current?.close();
  }

  function submitPersonEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingPerson === null) return;

    const trimmedName = editName.trim();
    if (!trimmedName) return;

    onRenamePerson(editingPerson.id, trimmedName);
    onSetContext(editingPerson.id, editContext.trim());
    onSetFollowUp(editingPerson.id, editDate || null);
    closeEditDialog();
  }

  function removeEditingPerson() {
    if (editingPerson === null) return;
    onRemovePerson(editingPerson.id);
    closeEditDialog();
  }

  return (
    <div className="surface-stack">
      <section className="intro-block people-intro">
        <div>
          <p className="eyebrow">Things involving other people</p>
          <h1>People</h1>
          <p className="intro-copy">
            Keep promises and waiting-for items visible without turning your
            workday into a CRM.
          </p>
        </div>
        <button type="button" className="people-add-button" onClick={openAddDialog}>
          <span aria-hidden="true">+</span>
          Add person
        </button>
      </section>

      {orderedPeople.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">↗</div>
          <div>
            <h2>No one is waiting on you</h2>
            <p>
              Add the people whose feedback, access or decisions you need to
              remember.
            </p>
          </div>
        </div>
      ) : (
        <section className="people-grid" aria-label="People and follow-ups">
          {orderedPeople.map((person) => {
            const tasks = tasksByPerson[person.id] ?? [];
            const isDue =
              person.nextFollowUpDate !== null &&
              person.nextFollowUpDate <= todayKey;

            return (
              <article
                key={person.id}
                className={isDue ? "person-card is-due" : "person-card"}
              >
                <header className="person-card-header">
                  <span className="person-avatar" aria-hidden="true">
                    {initials(person.name)}
                  </span>
                  <div className="person-card-heading">
                    <h2>{person.name}</h2>
                    <p className={isDue ? "person-due-label" : "person-date-label"}>
                      {followUpLabel(person.nextFollowUpDate, todayKey)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="person-manage-button"
                    aria-label={`Edit ${person.name}`}
                    onClick={() => openEditDialog(person)}
                  >
                    <span aria-hidden="true">•••</span>
                  </button>
                </header>

                {person.context ? (
                  <p className="person-context">{person.context}</p>
                ) : null}

                <div className="person-date-control">
                  <label>
                    <span>Next follow-up</span>
                    <input
                      type="date"
                      value={person.nextFollowUpDate ?? ""}
                      aria-label={`Next follow-up for ${person.name}`}
                      onChange={(event) =>
                        onSetFollowUp(person.id, event.currentTarget.value || null)
                      }
                    />
                  </label>
                  {person.nextFollowUpDate !== null ? (
                    <button
                      type="button"
                      onClick={() => onSetFollowUp(person.id, null)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {tasks.length > 0 ? (
                  <div className="person-linked-tasks">
                    <p className="section-kicker">Open together</p>
                    <ul>
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <span>{task.title}</span>
                          <small>{task.status}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="person-no-tasks">No open items with {person.name}.</p>
                )}

                <PersonFollowUpForm
                  person={person}
                  onAddFollowUpTask={onAddFollowUpTask}
                />
              </article>
            );
          })}
        </section>
      )}

      <dialog
        ref={addDialogRef}
        className="quick-capture-dialog person-dialog"
        aria-labelledby={addTitleId}
        onClose={() => {
          setName("");
          setContext("");
          setDate("");
        }}
      >
        <form className="quick-capture-form" onSubmit={submitPerson}>
          <div className="capture-heading">
            <div>
              <p className="eyebrow">People</p>
              <h2 id={addTitleId}>Add someone to remember</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close add person"
              onClick={closeAddDialog}
            >
              ×
            </button>
          </div>

          <div className="person-dialog-fields">
            <label>
              <span>Name</span>
              <input
                data-person-name
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                maxLength={120}
                required
              />
            </label>

            <label>
              <span>Context</span>
              <textarea
                value={context}
                onChange={(event) => setContext(event.currentTarget.value)}
                placeholder="What are you waiting for or discussing?"
                maxLength={2_000}
              />
            </label>

            <label>
              <span>Next follow-up</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.currentTarget.value)}
              />
            </label>
          </div>

          <div className="capture-footer">
            <p>Local only · no contacts uploaded</p>
            <button
              className="capture-submit"
              type="submit"
              disabled={!name.trim()}
            >
              Add person
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={editDialogRef}
        className="quick-capture-dialog person-dialog person-edit-dialog"
        aria-labelledby={editTitleId}
        onClose={resetEditDialog}
        onCancel={() => setConfirmingRemove(false)}
      >
        {editingPerson !== null ? (
          confirmingRemove ? (
            <div className="person-remove-confirmation">
              <div>
                <p className="eyebrow">Remove person</p>
                <h2 id={editTitleId}>Remove {editingPerson.name}?</h2>
              </div>
              <p>
                Their linked tasks will stay in DayDock and become unassigned.
                Only the person and follow-up context will be removed.
              </p>
              <div className="person-edit-actions">
                <button
                  type="button"
                  className="person-edit-secondary"
                  onClick={() => setConfirmingRemove(false)}
                >
                  Keep person
                </button>
                <button
                  type="button"
                  className="person-edit-danger"
                  onClick={removeEditingPerson}
                >
                  Remove person
                </button>
              </div>
            </div>
          ) : (
            <form className="quick-capture-form" onSubmit={submitPersonEdits}>
              <div className="capture-heading">
                <div>
                  <p className="eyebrow">People</p>
                  <h2 id={editTitleId}>Keep the context current</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close edit person"
                  onClick={closeEditDialog}
                >
                  ×
                </button>
              </div>

              <div className="person-dialog-fields">
                <label>
                  <span>Name</span>
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.currentTarget.value)}
                    maxLength={120}
                    autoFocus
                    required
                  />
                </label>

                <label>
                  <span>Context</span>
                  <textarea
                    value={editContext}
                    onChange={(event) => setEditContext(event.currentTarget.value)}
                    placeholder="What are you waiting for or discussing?"
                    maxLength={2_000}
                  />
                </label>

                <label>
                  <span>Next follow-up</span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(event) => setEditDate(event.currentTarget.value)}
                  />
                </label>
              </div>

              <div className="person-edit-actions">
                <button
                  type="button"
                  className="person-edit-remove"
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove…
                </button>
                <span className="person-edit-spacer" />
                <button
                  type="button"
                  className="person-edit-secondary"
                  onClick={closeEditDialog}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="capture-submit"
                  disabled={!editName.trim()}
                >
                  Save changes
                </button>
              </div>
            </form>
          )
        ) : null}
      </dialog>
    </div>
  );
}
