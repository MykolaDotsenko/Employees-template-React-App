import {
  useDeferredValue,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { Person, Task } from "../../domain/daydock/model";

export type PaletteSurface = "today" | "inbox" | "people" | "review";

interface CommandPaletteProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  tasks: Task[];
  people: Person[];
  currentTask: Task | null;
  onNavigate: (surface: PaletteSurface) => void;
  onQuickCapture: () => void;
  onStartFocus: (taskId: string) => void;
}

interface PaletteItem {
  id: string;
  label: string;
  meta: string;
  keywords: string;
  run: () => void;
}

function includesQuery(item: PaletteItem, query: string): boolean {
  const haystack = `${item.label} ${item.meta} ${item.keywords}`.toLocaleLowerCase();
  return haystack.includes(query);
}

export function CommandPalette({
  dialogRef,
  tasks,
  people,
  currentTask,
  onNavigate,
  onQuickCapture,
  onStartFocus,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const items = useMemo<PaletteItem[]>(() => {
    const navigation: PaletteItem[] = [
      {
        id: "nav-today",
        label: "Go to Today",
        meta: "Navigate",
        keywords: "today priorities now",
        run: () => onNavigate("today"),
      },
      {
        id: "nav-inbox",
        label: "Go to Inbox",
        meta: "Navigate",
        keywords: "inbox capture unsorted",
        run: () => onNavigate("inbox"),
      },
      {
        id: "nav-people",
        label: "Go to People",
        meta: "Navigate",
        keywords: "people follow up contacts",
        run: () => onNavigate("people"),
      },
      {
        id: "nav-review",
        label: "Go to Review",
        meta: "Navigate",
        keywords: "review completed close day",
        run: () => onNavigate("review"),
      },
    ];

    const actions: PaletteItem[] = [
      {
        id: "action-capture",
        label: "Quick Capture",
        meta: "Action · N",
        keywords: "add task thought note capture",
        run: onQuickCapture,
      },
    ];

    if (currentTask) {
      actions.push({
        id: `action-focus-${currentTask.id}`,
        label: `Focus: ${currentTask.title}`,
        meta: `Action · ${currentTask.estimateMinutes ?? 50} min`,
        keywords: "focus start timer deep work",
        run: () => onStartFocus(currentTask.id),
      });
    }

    if (!deferredQuery) {
      return [...actions, ...navigation];
    }

    const searchableTasks: PaletteItem[] = tasks
      .filter((task) => task.status !== "done")
      .map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      meta: `Task · ${task.status}`,
      keywords: `${task.status} task`,
      run: () =>
        onNavigate(
          task.status === "inbox" || task.status === "later"
            ? "inbox"
            : "today",
        ),
    }));

    const searchablePeople: PaletteItem[] = people.map((person) => ({
      id: `person-${person.id}`,
      label: person.name,
      meta: person.context ? `Person · ${person.context}` : "Person",
      keywords: `person follow up ${person.context}`,
      run: () => onNavigate("people"),
    }));

    return [...actions, ...navigation, ...searchableTasks, ...searchablePeople].filter(
      (item) => includesQuery(item, deferredQuery),
    );
  }, [
    currentTask,
    deferredQuery,
    onNavigate,
    onQuickCapture,
    onStartFocus,
    people,
    tasks,
  ]);

  function close() {
    dialogRef.current?.close();
  }

  function runItem(item: PaletteItem) {
    close();
    queueMicrotask(item.run);
  }

  function getResultButtons(): HTMLButtonElement[] {
    return Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-palette-item]") ??
        [],
    );
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      getResultButtons()[0]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      getResultButtons().at(-1)?.focus();
    }
  }

  function handleItemKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const buttons = getResultButtons();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      buttons.at(-1)?.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="command-palette"
      aria-label="Command palette"
      onClose={() => setQuery("")}
    >
      <div className="command-palette-shell">
        <div className="command-search">
          <span aria-hidden="true">⌕</span>
          <label>
            <span className="sr-only">Search commands, open tasks and people</span>
            <input
              data-command-input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search open work or run a command…"
              autoComplete="off"
            />
          </label>
          <kbd>Esc</kbd>
        </div>

        <div className="command-results" aria-live="polite">
          {items.length > 0 ? (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-palette-item
                className="command-result"
                onClick={() => runItem(item)}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
              >
                <span className="command-result-label">{item.label}</span>
                <span className="command-result-meta">{item.meta}</span>
              </button>
            ))
          ) : (
            <div className="command-empty">
              <strong>No match</strong>
              <span>Try a task, person, or destination.</span>
            </div>
          )}
        </div>

        <footer className="command-footer">
          <span>↑↓ navigate</span>
          <span>Enter select</span>
          <span>Private · local search</span>
        </footer>
      </div>
    </dialog>
  );
}
