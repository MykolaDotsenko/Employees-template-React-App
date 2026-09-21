import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StartDayPanel } from "./StartDayPanel";

const baseProps = {
  todayKey: "2026-09-21",
  existingPlan: null,
  readyAgainCount: 0,
  inboxCount: 0,
  duePeopleCount: 0,
  top3Count: 1,
  onOpenInbox: vi.fn(),
  onOpenPeople: vi.fn(),
  onStartDay: vi.fn(),
};

describe("StartDayPanel", () => {
  it("follows a changing calendar suggestion until the user adjusts it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <StartDayPanel {...baseProps} suggestedFocusRoomMinutes={120} />,
    );

    const focusRoom = screen.getByRole("combobox", {
      name: "Available focus room",
    });

    expect(focusRoom).toHaveValue("120");

    rerender(
      <StartDayPanel {...baseProps} suggestedFocusRoomMinutes={210} />,
    );

    expect(focusRoom).toHaveValue("210");

    await user.selectOptions(focusRoom, "150");
    expect(focusRoom).toHaveValue("150");

    rerender(
      <StartDayPanel {...baseProps} suggestedFocusRoomMinutes={240} />,
    );

    expect(focusRoom).toHaveValue("150");
  });
});
