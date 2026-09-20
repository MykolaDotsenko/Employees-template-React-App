import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createDayDockStore } from "./store/dayDockStore";

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
    expect(screen.getByText("Your day, clearly.")).toBeInTheDocument();
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByText("A fresh day")).toBeInTheDocument();
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
      name: "Search commands, tasks and people",
    });

    await user.type(search, "Anna");
    await user.click(within(palette).getByRole("button", { name: /Anna/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "People" }),
    ).toBeInTheDocument();
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
});
