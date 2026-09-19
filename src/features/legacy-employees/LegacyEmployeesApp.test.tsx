import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LegacyEmployeesApp } from "./LegacyEmployeesApp";

describe("LegacyEmployeesApp", () => {
  it("supports case-insensitive search", async () => {
    const user = userEvent.setup();
    render(<LegacyEmployeesApp />);

    await user.type(screen.getByRole("searchbox"), "myK");

    expect(screen.getByText("Mykola")).toBeInTheDocument();
    expect(screen.queryByText("Dennis")).not.toBeInTheDocument();
  });

  it("adds an employee and persists the change", async () => {
    const user = userEvent.setup();
    render(<LegacyEmployeesApp />);

    await user.type(screen.getByLabelText("Name"), "Anna");
    await user.type(screen.getByLabelText("Salary"), "4200");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Anna")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem("employees") ?? "[]") as Array<{
      name: string;
    }>;
    expect(stored.some((employee) => employee.name === "Anna")).toBe(true);
  });

  it("filters promotion candidates", async () => {
    const user = userEvent.setup();
    render(<LegacyEmployeesApp />);

    await user.click(screen.getByRole("button", { name: "Up for promotion" }));

    expect(screen.getByText("Mykola")).toBeInTheDocument();
    expect(screen.getByText("Dennis")).toBeInTheDocument();
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.queryByText("Ping")).not.toBeInTheDocument();
  });
});
