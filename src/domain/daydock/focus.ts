import type { ActiveFocusSession } from "./model";

const MINUTE_MS = 60_000;

export const DEFAULT_FOCUS_DURATION_MINUTES = 50;
export const MIN_FOCUS_DURATION_MINUTES = 5;
export const MAX_FOCUS_DURATION_MINUTES = 240;

export function normalizeFocusDurationMinutes(
  estimateMinutes: number | null,
): number {
  if (estimateMinutes === null || !Number.isFinite(estimateMinutes)) {
    return DEFAULT_FOCUS_DURATION_MINUTES;
  }

  return Math.min(
    MAX_FOCUS_DURATION_MINUTES,
    Math.max(MIN_FOCUS_DURATION_MINUTES, Math.round(estimateMinutes)),
  );
}

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getFocusElapsedMs(
  session: ActiveFocusSession,
  nowMs: number,
): number {
  const startedAtMs = parseTime(session.startedAt);
  const effectiveNowMs =
    session.pausedAt === null ? nowMs : parseTime(session.pausedAt);

  return Math.max(
    0,
    effectiveNowMs - startedAtMs - session.accumulatedPauseMs,
  );
}

export function getFocusRemainingMs(
  session: ActiveFocusSession,
  nowMs: number,
): number {
  return Math.max(
    0,
    session.durationMinutes * MINUTE_MS - getFocusElapsedMs(session, nowMs),
  );
}

export function getFocusProgress(
  session: ActiveFocusSession,
  nowMs: number,
): number {
  const durationMs = session.durationMinutes * MINUTE_MS;
  if (durationMs <= 0) return 1;

  return Math.min(1, getFocusElapsedMs(session, nowMs) / durationMs);
}

export function formatFocusClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
