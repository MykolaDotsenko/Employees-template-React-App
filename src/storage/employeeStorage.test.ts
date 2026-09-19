import { describe, expect, it } from "vitest";
import { DEFAULT_EMPLOYEES } from "../domain/employee";
import { loadEmployees, saveEmployees } from "./employeeStorage";

describe("employee storage migration bridge", () => {
  it("returns defaults when stored JSON is corrupted", () => {
    localStorage.setItem("employees", "{bad json");

    expect(loadEmployees()).toEqual(DEFAULT_EMPLOYEES);
  });

  it("normalizes legacy numeric ids and string salaries", () => {
    localStorage.setItem(
      "employees",
      JSON.stringify([
        {
          id: 7,
          name: "  Anna  ",
          salary: "4100",
          increase: false,
          rise: true,
        },
      ]),
    );

    expect(loadEmployees()).toEqual([
      {
        id: "7",
        name: "Anna",
        salary: 4100,
        increase: false,
        rise: true,
      },
    ]);
  });

  it("persists normalized employees", () => {
    saveEmployees([
      {
        id: "employee-1",
        name: "Anna",
        salary: 4100,
        increase: true,
        rise: false,
      },
    ]);

    expect(JSON.parse(localStorage.getItem("employees") ?? "[]")).toEqual([
      {
        id: "employee-1",
        name: "Anna",
        salary: 4100,
        increase: true,
        rise: false,
      },
    ]);
  });
});
