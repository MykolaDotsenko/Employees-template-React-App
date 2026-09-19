import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Finish PR review")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Add person" }));

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
    expect(screen.getByText("Ask about revised mockups")).toBeInTheDocument();
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
