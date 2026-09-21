import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createInitialDayDockState,
  type DayDockState,
} from "../../domain/daydock/model";
import { serializeDayDockBackup } from "../../storage/dayDockBackup";
import { DataSafetyPopover } from "./DataSafetyPopover";

describe("DataSafetyPopover", () => {
  it("previews and restores a validated backup", async () => {
    const user = userEvent.setup();
    const restored = createInitialDayDockState();

    restored.tasks.a = {
      id: "a",
      title: "Restored task",
      status: "inbox",
      estimateMinutes: null,
      personId: null,
      deferUntil: null,
      recurrence: null,
      createdAt: "2026-09-19T08:00:00.000Z",
      completedAt: null,
    };
    restored.taskOrder.push("a");

    const restoredStates: DayDockState[] = [];
    const onRestore = (state: DayDockState) => {
      restoredStates.push(state);
    };

    render(
      <DataSafetyPopover
        state={createInitialDayDockState()}
        persistenceStatus="durable"
        notificationPermission="default"
        onReadyAgainNotificationsChange={() =>
          Promise.resolve({ status: "disabled" })
        }
        onRestore={onRestore}
      />,
    );

    const raw = serializeDayDockBackup(
      restored,
      () => "2026-09-19T12:00:00.000Z",
    );
    const file = new File([raw], "backup.json", {
      type: "application/json",
    });

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      file,
    );

    expect(await screen.findByText("Ready to restore")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "dd" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Restore backup",
        hidden: true,
      }),
    );

    expect(restoredStates).toHaveLength(1);
    expect(restoredStates[0]?.tasks.a?.title).toBe("Restored task");
    expect(
      screen.getByText("Workspace restored. Open tabs will receive the new state."),
    ).toBeInTheDocument();
  });

  it("rejects a foreign backup before restore becomes available", async () => {
    const user = userEvent.setup();

    render(
      <DataSafetyPopover
        state={createInitialDayDockState()}
        persistenceStatus="durable"
        notificationPermission="default"
        onReadyAgainNotificationsChange={() =>
          Promise.resolve({ status: "disabled" })
        }
        onRestore={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      new File(["{}"], "foreign.json", {
        type: "application/json",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("This file is not a valid DayDock backup."),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", {
        name: "Restore backup",
        hidden: true,
      }),
    ).not.toBeInTheDocument();
  });

  it("explains when the workspace is running without durable browser storage", () => {
    render(
      <DataSafetyPopover
        state={createInitialDayDockState()}
        persistenceStatus="memory"
        notificationPermission="default"
        onReadyAgainNotificationsChange={() =>
          Promise.resolve({ status: "disabled" })
        }
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByText("Storage warning")).toBeInTheDocument();
    expect(
      screen.getByText(/running in memory only/i),
    ).toBeInTheDocument();
  });

  it("treats a restored alert preference as inactive until this browser grants permission", async () => {
    const user = userEvent.setup();
    const state = createInitialDayDockState();
    state.notifications.readyAgain = true;
    const changes: boolean[] = [];

    render(
      <DataSafetyPopover
        state={state}
        persistenceStatus="durable"
        notificationPermission="default"
        onReadyAgainNotificationsChange={(enabled) => {
          changes.push(enabled);
          return Promise.resolve({ status: "enabled" });
        }}
        onRestore={vi.fn()}
      />,
    );

    const enable = screen.getByRole("button", { name: "Enable", hidden: true });
    expect(enable).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/this browser still needs notification permission/i),
    ).toBeInTheDocument();

    await user.click(enable);

    expect(changes).toEqual([true]);
    expect(
      await screen.findByText(
        "Ready again alerts are enabled for this browser.",
      ),
    ).toBeInTheDocument();
  });

  it("shows when a restored alert preference is blocked by browser permission", () => {
    const state = createInitialDayDockState();
    state.notifications.readyAgain = true;

    render(
      <DataSafetyPopover
        state={state}
        persistenceStatus="durable"
        notificationPermission="denied"
        onReadyAgainNotificationsChange={() =>
          Promise.resolve({ status: "denied" })
        }
        onRestore={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Enable", hidden: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/notifications are blocked in this browser/i),
    ).toBeInTheDocument();
  });

  it("enables Ready again alerts only through the explicit control", async () => {
    const user = userEvent.setup();
    const changes: boolean[] = [];

    render(
      <DataSafetyPopover
        state={createInitialDayDockState()}
        persistenceStatus="durable"
        notificationPermission="default"
        onReadyAgainNotificationsChange={(enabled) => {
          changes.push(enabled);
          return Promise.resolve({ status: "enabled" });
        }}
        onRestore={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Enable", hidden: true }),
    );

    expect(changes).toEqual([true]);
    expect(
      await screen.findByText(
        "Ready again alerts are enabled for this browser.",
      ),
    ).toBeInTheDocument();
  });

});
