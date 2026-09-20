import { describe, expect, it } from "vitest";
import {
  createInitialDayDockState,
  type DayDockState,
} from "../domain/daydock/model";
import {
  DAYDOCK_BACKUP_FORMAT,
  DAYDOCK_BACKUP_FORMAT_VERSION,
  parseDayDockBackup,
  serializeDayDockBackup,
  summarizeDayDockBackup,
} from "./dayDockBackup";
import { DAYDOCK_SCHEMA_VERSION } from "./dayDockPersistence";

function workspace(): DayDockState {
  const state = createInitialDayDockState();

  state.people.anna = {
    id: "anna",
    name: " Anna ",
    context: " Design feedback ",
    nextFollowUpDate: "2026-09-21",
    createdAt: "2026-09-19T08:00:00.000Z",
  };
  state.personOrder.push("anna");

  state.tasks.a = {
    id: "a",
    title: " Review mobile flow ",
    status: "today",
    estimateMinutes: 30,
    personId: "anna",
    deferUntil: null,
    recurrence: null,
    createdAt: "2026-09-19T08:00:00.000Z",
    completedAt: null,
  };
  state.taskOrder.push("a");

  state.focus.history.push({
    id: "focus-a",
    taskId: "a",
    startedAt: "2026-09-19T09:00:00.000Z",
    durationMinutes: 30,
    pausedAt: null,
    accumulatedPauseMs: 0,
    endedAt: "2026-09-19T09:25:00.000Z",
    outcome: "stopped",
  });

  return state;
}

describe("DayDock portable backups", () => {
  it("round-trips a normalized versioned workspace", () => {
    const raw = serializeDayDockBackup(
      workspace(),
      () => "2026-09-19T12:00:00.000Z",
    );

    const decoded = JSON.parse(raw) as {
      format?: string;
      formatVersion?: number;
      appSchemaVersion?: number;
    };

    expect(decoded).toMatchObject({
      format: DAYDOCK_BACKUP_FORMAT,
      formatVersion: DAYDOCK_BACKUP_FORMAT_VERSION,
      appSchemaVersion: DAYDOCK_SCHEMA_VERSION,
    });

    const backup = parseDayDockBackup(raw);

    expect(backup?.exportedAt).toBe("2026-09-19T12:00:00.000Z");
    expect(backup?.state.people.anna?.name).toBe("Anna");
    expect(backup?.state.tasks.a?.title).toBe("Review mobile flow");
    expect(backup?.state.tasks.a?.personId).toBe("anna");
  });

  it("rejects malformed, foreign and structurally invalid backups", () => {
    expect(parseDayDockBackup("{not-json")).toBeNull();

    expect(
      parseDayDockBackup(
        JSON.stringify({
          format: "another-app",
          formatVersion: 1,
          exportedAt: "2026-09-19T12:00:00.000Z",
          appSchemaVersion: DAYDOCK_SCHEMA_VERSION,
          data: createInitialDayDockState(),
        }),
      ),
    ).toBeNull();

    expect(
      parseDayDockBackup(
        JSON.stringify({
          format: DAYDOCK_BACKUP_FORMAT,
          formatVersion: DAYDOCK_BACKUP_FORMAT_VERSION,
          exportedAt: "2026-09-19T12:00:00.000Z",
          appSchemaVersion: DAYDOCK_SCHEMA_VERSION,
          data: {
            ...createInitialDayDockState(),
            tasks: "not-a-record",
          },
        }),
      ),
    ).toBeNull();
  });

  it("summarizes backup contents without duplicating analytics", () => {
    expect(summarizeDayDockBackup(workspace())).toEqual({
      taskCount: 1,
      personCount: 1,
      focusSessionCount: 1,
    });
  });
});
