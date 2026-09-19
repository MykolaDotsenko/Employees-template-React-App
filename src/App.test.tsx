import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createDayDockStore } from "./store/dayDockStore";

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
    expect(store.getSnapshot().tasks[store.getSnapshot().taskOrder[0] ?? ""]?.status).toBe(
      "inbox",
    );

    await user.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByText("Finish PR review")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Move Finish PR review to Today" }),
    );

    expect(screen.queryByText("Finish PR review")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("Finish PR review")).toBeInTheDocument();
  });

  it("promotes a Today item into Top 3 and completes it", async () => {
    const user = userEvent.setup();
    const store = createDayDockStore();

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

    render(<App store={store} />);

    await user.click(
      screen.getByRole("button", { name: "Add Write architecture notes to Top 3" }),
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(store.getSnapshot().top3).toEqual(["a"]);

    await user.click(
      screen.getByRole("button", { name: "Complete Write architecture notes" }),
    );

    expect(store.getSnapshot().tasks.a?.status).toBe("done");
    expect(store.getSnapshot().top3).toEqual([]);
  });

  it("opens Quick Capture with the N shortcut outside editable controls", async () => {
    const user = userEvent.setup();
    render(<App store={createDayDockStore()} />);

    await user.keyboard("n");

    expect(
      screen.getByRole("dialog", { name: "What’s on your mind?" }),
    ).toHaveAttribute("open");
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
