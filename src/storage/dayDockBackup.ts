import { z } from "zod";
import type { DayDockState } from "../domain/daydock/model";
import {
  DAYDOCK_SCHEMA_VERSION,
  normalizeDayDockState,
  parseDayDockState,
} from "./dayDockPersistence";

export const DAYDOCK_BACKUP_FORMAT = "daydock-backup" as const;
export const DAYDOCK_BACKUP_FORMAT_VERSION = 1 as const;
export const DAYDOCK_BACKUP_MAX_BYTES = 5_000_000;

const isoDateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Expected a valid date-time string",
);

const backupEnvelopeSchema = z.object({
  format: z.literal(DAYDOCK_BACKUP_FORMAT),
  formatVersion: z.literal(DAYDOCK_BACKUP_FORMAT_VERSION),
  exportedAt: isoDateTimeSchema,
  appSchemaVersion: z
    .number()
    .int()
    .min(0)
    .max(DAYDOCK_SCHEMA_VERSION),
  data: z.unknown(),
});

export interface DayDockBackup {
  state: DayDockState;
  exportedAt: string;
  appSchemaVersion: number;
}

export interface DayDockBackupSummary {
  taskCount: number;
  personCount: number;
  focusSessionCount: number;
}

function defaultNow(): string {
  return new Date().toISOString();
}

export function serializeDayDockBackup(
  state: DayDockState,
  now: () => string = defaultNow,
): string {
  return JSON.stringify(
    {
      format: DAYDOCK_BACKUP_FORMAT,
      formatVersion: DAYDOCK_BACKUP_FORMAT_VERSION,
      exportedAt: now(),
      appSchemaVersion: DAYDOCK_SCHEMA_VERSION,
      data: normalizeDayDockState(state),
    },
    null,
    2,
  );
}

export function parseDayDockBackup(raw: string): DayDockBackup | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelope = backupEnvelopeSchema.safeParse(value);
  if (!envelope.success) return null;

  const state = parseDayDockState(envelope.data.data);
  if (state === null) return null;

  return {
    state,
    exportedAt: envelope.data.exportedAt,
    appSchemaVersion: envelope.data.appSchemaVersion,
  };
}

export function summarizeDayDockBackup(
  state: DayDockState,
): DayDockBackupSummary {
  return {
    taskCount: state.taskOrder.length,
    personCount: state.personOrder.length,
    focusSessionCount: state.focus.history.length,
  };
}
