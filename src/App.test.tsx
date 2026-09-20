import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createDayDockStore } from "./store/dayDockStore";
import {
  createPersistentDayDockStore,
  type StorageLike,
} from "./storage/dayDockPersistence";

function addTodayPriority(store: ReturnType<typeof createDayDockStore>) {
  store.dispatch({
    type: "task/captured",
    task: {
      id: "a",
      title: "Write architecture notes",
      status: "today",
      estimateMinutes: 30,
      personId: null,
      createdAt: "2026-09-19T08:00:00.000Z",
      completedAt: null,
    },
  });
  store.dispatch({ type: "top3/added", taskId: "a" });
}

describe("DayDock core daily flow", () => {
  it("renders the light local-first Today experience by default", () => {
    render(<App store={createDayDockStore()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Make room for what matters.")).toBeInTheDocument();
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByText("A fresh day")).toBeInTheDocument();
  });

  it("guides a fresh workspace into the first capture without a tutorial modal", async () => {
    const user = userEvent.setup();
    render(<App store={createDayDockStore()} />);

    expect(
      screen.getByRole("heading", { name: "A fresh day" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "DayDock getting started" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Capture your first item" }),
    );

    expect(
      screen.getByRole("dialog", { name: "What’s on your mind?" }),
    ).toHaveAttribute("open");
    expect(
      screen.getByRole("textbox", { name: "Capture item" }),
    ).toHaveFocus();
  });

  it("moves first-run guidance from Capture to Decide after the first item", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", { name: "Capture your first item" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Capture item" }),
      "Prepare release checklist",
    );
    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(
      screen.getByRole("heading", { name: "Your first item is safe" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Inbox" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Inbox" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Prepare release checklist")).toBeInTheDocument();
  });

  it("opens capture from the mobile-primary navigation action", async () => {
    const user = userEvent.setup();

    render(<App store={createDayDockStore()} />);

    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(
      screen.getByRole("dialog", { name: "What’s on your mind?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Capture item" }),
    ).toHaveFocus();
  });

  it("captures an item into Inbox and processes it into Today", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: "Quick capture" }));
    await user.type(
      screen.getByRole("textbox", { name: "Capture item" }),
      "Finish PR review",
    );
    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(store.getSnapshot().taskOrder).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByText("Finish PR review")).toBeInTheDocument();
    expect(screen.queryByText("No estimate")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Move Finish PR review to Today" }),
    );

    await user.click(screen.getByRole("button", { name: "Today" }));

    const todaySection = screen
      .getByRole("heading", { name: "What matters today" })
      .closest("section");
    expect(todaySection).not.toBeNull();
    expect(
      within(todaySection as HTMLElement).getByText("Finish PR review"),
    ).toBeInTheDocument();
  });

  it("starts, pauses, resumes and completes a focus session", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    addTodayPriority(store);

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: /Start focus/i }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Write architecture notes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("30 min session · saved locally")).toBeInTheDocument();
    expect(store.getSnapshot().focus.active?.taskId).toBe("a");

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(store.getSnapshot().focus.active?.pausedAt).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(store.getSnapshot().focus.active?.pausedAt).toBeNull();

    await user.click(screen.getByRole("button", { name: "Complete task" }));

    expect(store.getSnapshot().tasks.a?.status).toBe("done");
    expect(store.getSnapshot().focus.active).toBeNull();
    expect(store.getSnapshot().focus.history[0]?.outcome).toBe("completed");
  });

  it("lets the user choose a shorter focus block before starting", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    addTodayPriority(store);

    render(<App store={store} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Focus duration" }),
      "25",
    );
    await user.click(screen.getByRole("button", { name: /Start focus/i }));

    expect(store.getSnapshot().focus.active?.durationMinutes).toBe(25);
    expect(screen.getByText("25 min session · saved locally")).toBeInTheDocument();
    expect(document.querySelector(".focus-topbar .brand-mark svg")).not.toBeNull();
  });

  it("stops focus without completing the task", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    addTodayPriority(store);

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: /Start focus/i }));
    await user.click(screen.getByRole("button", { name: "End session" }));

    expect(store.getSnapshot().focus.active).toBeNull();
    expect(store.getSnapshot().focus.history[0]?.outcome).toBe("stopped");
    expect(store.getSnapshot().tasks.a?.status).toBe("today");
  });

  it("opens Quick Capture with the N shortcut outside editable controls", async () => {
    const user = userEvent.setup();
    render(<App store={createDayDockStore()} />);

    await user.keyboard("n");

    expect(
      screen.getByRole("dialog", { name: "What’s on your mind?" }),
    ).toHaveAttribute("open");
  });

  it("adds a person and creates a linked follow-up task", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: "People" }));
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await user.type(screen.getByLabelText("Name"), "Anna");
    await user.type(
      screen.getByLabelText("Context"),
      "Waiting for mobile navigation feedback",
    );

    const addPersonDialog = screen.getByRole("dialog", {
      name: "Add someone to remember",
    });
    await user.click(
      within(addPersonDialog).getByRole("button", { name: "Add person" }),
    );

    expect(screen.getByRole("heading", { name: "Anna" })).toBeInTheDocument();
    expect(store.getSnapshot().personOrder).toHaveLength(1);

    await user.type(
      screen.getByRole("textbox", { name: "Follow-up task for Anna" }),
      "Ask about revised mockups",
    );
    await user.click(
      screen.getByRole("button", { name: "Add" }),
    );

    const personId = store.getSnapshot().personOrder[0];
    expect(personId).toBeDefined();

    const linkedTasks = store
      .getSnapshot()
      .taskOrder.map((taskId) => store.getSnapshot().tasks[taskId])
      .filter((task) => task?.personId === personId);

    expect(linkedTasks).toHaveLength(1);
    expect(linkedTasks[0]?.status).toBe("inbox");

    const annaHeading = screen.getByRole("heading", { name: "Anna" });
    const annaCard = annaHeading.closest("article");
    expect(annaCard).not.toBeNull();
    expect(
      within(annaCard as HTMLElement).getByText("Ask about revised mockups"),
    ).toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+K and navigates from search", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "person/added",
      person: {
        id: "anna",
        name: "Anna",
        context: "Design feedback",
        nextFollowUpDate: null,
        createdAt: "2026-09-19T08:00:00.000Z",
      },
    });

    render(<App store={store} />);

    await user.keyboard("{Control>}k{/Control}");

    const palette = screen.getByRole("dialog", { name: "Command palette" });
    const search = within(palette).getByRole("textbox", {
      name: "Search commands, open tasks and people",
    });

    await user.type(search, "Anna");
    await user.click(within(palette).getByRole("button", { name: /Anna/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "People" }),
    ).toBeInTheDocument();
  });

  it("does not surface completed history as an actionable search result", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "completed-search",
        title: "Archived release note",
        status: "done",
        estimateMinutes: null,
        personId: null,
        createdAt: "2026-09-18T09:00:00.000Z",
        completedAt: "2026-09-18T10:00:00.000Z",
      },
    });

    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", { name: "Open command palette" }),
    );
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    await user.type(
      within(palette).getByRole("textbox", {
        name: "Search commands, open tasks and people",
      }),
      "Archived release note",
    );

    expect(
      within(palette).queryByText("Archived release note"),
    ).not.toBeInTheDocument();
    expect(within(palette).getByText("No match")).toBeInTheDocument();
  });

  it("starts focus from the contextual command palette", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    addTodayPriority(store);
    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", { name: "Open command palette" }),
    );

    const palette = screen.getByRole("dialog", { name: "Command palette" });
    await user.click(
      within(palette).getByRole("button", {
        name: /Focus: Write architecture notes/,
      }),
    );

    expect(store.getSnapshot().focus.active?.taskId).toBe("a");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Write architecture notes",
      }),
    ).toBeInTheDocument();
  });

  it("lets Review resolve unfinished Today work without a productivity score", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "review-task",
        title: "Resolve review notes",
        status: "today",
        estimateMinutes: 20,
        personId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    });

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(
      screen.getByRole("heading", { name: "Before you close the day" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/productivity score/i)).not.toBeInTheDocument();

    const reviewRegion = screen.getByRole("heading", {
      name: "Before you close the day",
    }).closest("section");
    expect(reviewRegion).not.toBeNull();

    await user.click(
      within(reviewRegion as HTMLElement).getByRole("button", {
        name: "Move Resolve review notes to Later",
      }),
    );

    expect(store.getSnapshot().tasks["review-task"]?.status).toBe("later");
    expect(
      screen.getByRole("heading", { name: "Everything has a home" }),
    ).toBeInTheDocument();
  });

  it("shows focus-session detail and routes next attention from Review", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    const now = new Date();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "focus-detail",
        title: "Review API contract",
        status: "today",
        estimateMinutes: 25,
        personId: null,
        createdAt: now.toISOString(),
        completedAt: null,
      },
    });
    store.dispatch({
      type: "task/captured",
      task: {
        id: "inbox-detail",
        title: "Triage release note",
        status: "inbox",
        estimateMinutes: null,
        personId: null,
        createdAt: now.toISOString(),
        completedAt: null,
      },
    });
    store.dispatch({
      type: "focus/started",
      session: {
        id: "focus-review-detail",
        taskId: "focus-detail",
        startedAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
        durationMinutes: 25,
        pausedAt: null,
        accumulatedPauseMs: 0,
      },
    });
    store.dispatch({
      type: "focus/finished",
      endedAt: now.toISOString(),
      outcome: "stopped",
    });

    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "Review" }));

    const focusSection = screen
      .getByRole("heading", { name: "Focus blocks" })
      .closest("section");
    expect(focusSection).not.toBeNull();
    expect(
      within(focusSection as HTMLElement).getByText("Review API contract"),
    ).toBeInTheDocument();
    expect(
      within(focusSection as HTMLElement).getByText("Stopped"),
    ).toBeInTheDocument();

    const nextAttention = screen
      .getByRole("heading", { name: "Anything still waiting?" })
      .closest("section");
    expect(nextAttention).not.toBeNull();
    expect(
      within(nextAttention as HTMLElement).getByText("1 item waiting"),
    ).toBeInTheDocument();

    await user.click(
      within(nextAttention as HTMLElement).getByRole("button", {
        name: /Inbox/,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Inbox" }),
    ).toBeInTheDocument();
  });

  it("preserves a People follow-up draft across Activity navigation", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "person/added",
      person: {
        id: "anna",
        name: "Anna",
        context: "Design feedback",
        nextFollowUpDate: null,
        createdAt: "2026-09-19T08:00:00.000Z",
      },
    });

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: "People" }));
    const draft = screen.getByRole("textbox", {
      name: "Follow-up task for Anna",
    });
    await user.type(draft, "Check final mobile flow");

    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "People" }));

    expect(
      screen.getByRole("textbox", { name: "Follow-up task for Anna" }),
    ).toHaveValue("Check final mobile flow");
  });

  it("navigates between People and Review without losing primary semantics", async () => {
    const user = userEvent.setup();
    render(<App store={createDayDockStore()} />);

    await user.click(screen.getByRole("button", { name: "People" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "People" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Review" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });
  it("keeps deferred work visible and lets it return to Today", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "deferred",
        title: "Revisit onboarding copy",
        status: "inbox",
        estimateMinutes: null,
        personId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    });

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: "Inbox" }));
    await user.click(
      screen.getByRole("button", {
        name: "Move Revisit onboarding copy to Later",
      }),
    );

    const laterSection = screen
      .getByRole("heading", { name: "Later" })
      .closest("section");
    expect(laterSection).not.toBeNull();
    expect(
      within(laterSection as HTMLElement).getByText("Revisit onboarding copy"),
    ).toBeInTheDocument();

    await user.click(
      within(laterSection as HTMLElement).getByRole("button", {
        name: "Move Revisit onboarding copy to Today",
      }),
    );

    expect(store.getSnapshot().tasks.deferred?.status).toBe("today");

    await user.click(screen.getByRole("button", { name: "Today" }));

    const todaySection = screen
      .getByRole("heading", { name: "What matters today" })
      .closest("section");
    expect(todaySection).not.toBeNull();
    expect(
      within(todaySection as HTMLElement).getByText("Revisit onboarding copy"),
    ).toBeInTheDocument();
  });

  it("routes deferred task search to Inbox where Later is visible", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "later-search",
        title: "Investigate offline analytics",
        status: "later",
        estimateMinutes: null,
        personId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    });

    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", { name: "Open command palette" }),
    );
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    await user.type(
      within(palette).getByRole("textbox", {
        name: "Search commands, open tasks and people",
      }),
      "offline analytics",
    );
    await user.click(
      within(palette).getByRole("button", {
        name: /Investigate offline analytics/,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Inbox" }),
    ).toBeInTheDocument();
    const laterSection = screen
      .getByRole("heading", { name: "Later" })
      .closest("section");
    expect(laterSection).not.toBeNull();
    expect(
      within(laterSection as HTMLElement).getByText(
        "Investigate offline analytics",
      ),
    ).toBeInTheDocument();
  });

  it("lets a user unpin a Top 3 item without losing it from Today", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();
    addTodayPriority(store);

    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", {
        name: "Remove Write architecture notes from Top 3",
      }),
    );

    expect(store.getSnapshot().top3).toHaveLength(0);
    expect(store.getSnapshot().tasks.a?.status).toBe("today");

    const todaySection = screen
      .getByRole("heading", { name: "What matters today" })
      .closest("section");
    expect(todaySection).not.toBeNull();
    expect(
      within(todaySection as HTMLElement).getByText("Write architecture notes"),
    ).toBeInTheDocument();
    expect(
      within(todaySection as HTMLElement).getByRole("button", {
        name: "Add Write architecture notes to Top 3",
      }),
    ).toBeInTheDocument();
  });

  it("clamps oversized imported estimates before entering Focus Mode", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "oversized-focus",
        title: "Deep architecture review",
        status: "today",
        estimateMinutes: 1_440,
        personId: null,
        createdAt: "2026-09-20T09:00:00.000Z",
        completedAt: null,
      },
    });
    store.dispatch({ type: "top3/added", taskId: "oversized-focus" });

    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: /Start focus/i }));

    expect(store.getSnapshot().focus.active?.durationMinutes).toBe(240);
    expect(
      screen.getByText("240 min session · saved locally"),
    ).toBeInTheDocument();
  });


  it("lets a user rename and deliberately remove an open task", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "editable-task",
        title: "Draft release announcement",
        status: "inbox",
        estimateMinutes: null,
        personId: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        completedAt: null,
      },
    });

    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "Inbox" }));

    await user.click(
      screen.getByRole("button", {
        name: "Edit or remove Draft release announcement",
      }),
    );

    const editor = screen.getByRole("dialog", {
      name: "Keep the wording useful",
    });
    const title = within(editor).getByLabelText("Task title");
    await user.clear(title);
    await user.type(title, "Publish release announcement");
    await user.click(
      within(editor).getByRole("button", { name: "Save changes" }),
    );

    expect(store.getSnapshot().tasks["editable-task"]?.title).toBe(
      "Publish release announcement",
    );
    expect(screen.getByText("Publish release announcement")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Edit or remove Publish release announcement",
      }),
    );
    const updatedEditor = screen.getByRole("dialog", {
      name: "Keep the wording useful",
    });
    await user.click(
      within(updatedEditor).getByRole("button", { name: "Remove…" }),
    );

    const confirmation = screen.getByRole("dialog", {
      name: "Remove “Publish release announcement”?",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Remove task" }),
    );

    expect(store.getSnapshot().tasks["editable-task"]).toBeUndefined();
    expect(
      screen.queryByText("Publish release announcement"),
    ).not.toBeInTheDocument();
  });

  it("lets a user recover an accidentally completed task from Review", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "task/captured",
      task: {
        id: "reopen-task",
        title: "Fix docs typo",
        status: "today",
        estimateMinutes: null,
        personId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    });
    store.dispatch({
      type: "task/completed",
      taskId: "reopen-task",
      completedAt: new Date().toISOString(),
    });

    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "Review" }));

    await user.click(
      screen.getByRole("button", {
        name: "Reopen Fix docs typo to Today",
      }),
    );

    expect(store.getSnapshot().tasks["reopen-task"]?.status).toBe("today");
    expect(store.getSnapshot().tasks["reopen-task"]?.completedAt).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Before you close the day" }),
    ).toBeInTheDocument();
  });


  it("warns immediately after a browser persistence write fails", async () => {
    const user = userEvent.setup();
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };
    const store = createPersistentDayDockStore({ storage });

    render(<App store={store} />);
    expect(screen.getByText("Private by default")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Capture your first item" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Capture item" }),
      "Protect this unsaved thought",
    );
    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(screen.getByText("Storage warning")).toBeInTheDocument();
    expect(screen.getByText("Save problem")).toBeInTheDocument();
    expect(
      screen.getByText("Latest changes may not survive reload"),
    ).toBeInTheDocument();
    expect(store.getSnapshot().tasks).not.toEqual({});
  });


  it("lets a user keep person context current without recreating the contact", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "person/added",
      person: {
        id: "anna-edit",
        name: "Anna",
        context: "Waiting for first draft",
        nextFollowUpDate: null,
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    });

    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "People" }));
    await user.click(screen.getByRole("button", { name: "Edit Anna" }));

    const dialog = screen.getByRole("dialog", {
      name: "Keep the context current",
    });
    const name = within(dialog).getByLabelText("Name");
    const context = within(dialog).getByLabelText("Context");

    await user.clear(name);
    await user.type(name, "Anna Rivera");
    await user.clear(context);
    await user.type(context, "Final mobile review");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(store.getSnapshot().people["anna-edit"]?.name).toBe("Anna Rivera");
    expect(store.getSnapshot().people["anna-edit"]?.context).toBe(
      "Final mobile review",
    );
    expect(screen.getByRole("heading", { name: "Anna Rivera" })).toBeInTheDocument();
    expect(screen.getByText("Final mobile review")).toBeInTheDocument();
  });

  it("removes a person while keeping their linked task safe in Inbox", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

    store.dispatch({
      type: "person/added",
      person: {
        id: "anna-remove",
        name: "Anna",
        context: "Release copy",
        nextFollowUpDate: null,
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    });
    store.dispatch({
      type: "task/captured",
      task: {
        id: "safe-linked-task",
        title: "Keep the linked task",
        status: "inbox",
        estimateMinutes: null,
        personId: "anna-remove",
        createdAt: "2026-09-20T08:30:00.000Z",
        completedAt: null,
      },
    });

    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "People" }));
    await user.click(screen.getByRole("button", { name: "Edit Anna" }));

    const editDialog = screen.getByRole("dialog", {
      name: "Keep the context current",
    });
    await user.click(
      within(editDialog).getByRole("button", { name: "Remove…" }),
    );

    const confirmation = screen.getByRole("dialog", {
      name: "Remove Anna?",
    });
    expect(
      within(confirmation).getByText(/linked tasks will stay in DayDock/i),
    ).toBeInTheDocument();

    await user.click(
      within(confirmation).getByRole("button", { name: "Remove person" }),
    );

    expect(store.getSnapshot().people["anna-remove"]).toBeUndefined();
    expect(store.getSnapshot().tasks["safe-linked-task"]?.personId).toBeNull();

    await user.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByText("Keep the linked task")).toBeInTheDocument();
  });

});
