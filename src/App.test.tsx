import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createDayDockStore } from "./store/dayDockStore";

describe("DayDock app shell", () => {
  it("renders the light local-first Today experience by default", () => {
    render(<App store={createDayDockStore()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your day, clearly.")).toBeInTheDocument();
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByText("A fresh day")).toBeInTheDocument();
  });

  it("navigates between the four primary product surfaces", async () => {
    const user = userEvent.setup();
    render(<App store={createDayDockStore()} />);

    await user.click(screen.getByRole("button", { name: /Inbox/i }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Inbox" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /People/i }));
    expect(
      screen.getByRole("heading", { level: 1, name: "People" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Review/i }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Review" }),
    ).toBeInTheDocument();
  });

  it("exposes a skip link and current navigation state", () => {
    render(<App store={createDayDockStore()} />);

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("button", { name: /Today/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
