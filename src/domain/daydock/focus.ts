import type { ActiveFocusSession } from "./model";

const MINUTE_MS = 60_000;

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
