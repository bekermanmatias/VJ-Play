export type ReplayShiftTurnoOption = { value: string; label: string };

export type ReplayShiftConfig = {
  shiftDurationSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  source?: "database" | "env";
};

const DEFAULT_SHIFT_SECONDS = 3600;
const DEFAULT_WINDOW_START_HOUR = 8;
const DEFAULT_WINDOW_END_HOUR = 24;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || String(raw).trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

function envShiftDurationSeconds(): number {
  const n = parsePositiveInt(import.meta.env.PUBLIC_REPLAY_SHIFT_DURATION_SECONDS, DEFAULT_SHIFT_SECONDS);
  if (n < 300 || n > 28_800) {
    return DEFAULT_SHIFT_SECONDS;
  }
  return n;
}

function envWindowStartHour(): number {
  const n = parsePositiveInt(import.meta.env.PUBLIC_REPLAY_SHIFTS_WINDOW_START_HOUR, DEFAULT_WINDOW_START_HOUR);
  if (n < 0 || n > 23) {
    return DEFAULT_WINDOW_START_HOUR;
  }
  return n;
}

function envWindowEndHour(): number {
  const n = parsePositiveInt(import.meta.env.PUBLIC_REPLAY_SHIFTS_WINDOW_END_HOUR, DEFAULT_WINDOW_END_HOUR);
  if (n < 1 || n > 24) {
    return DEFAULT_WINDOW_END_HOUR;
  }
  return n;
}

/** Valores por defecto desde variables públicas de build (cuando no hay API o falla la red). */
export function getDefaultReplayShiftConfigFromEnv(): ReplayShiftConfig {
  return {
    shiftDurationSeconds: envShiftDurationSeconds(),
    windowStartHour: envWindowStartHour(),
    windowEndHour: envWindowEndHour(),
    source: "env",
  };
}

function minutesToClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Opciones de turno para selects: `value` es el inicio (HH:MM), usable en `buildReplayMatchKey`.
 */
export function buildReplayShiftTurnosFromConfig(config: ReplayShiftConfig): ReplayShiftTurnoOption[] {
  const shiftMin = Math.round(config.shiftDurationSeconds / 60);
  if (shiftMin < 1) {
    return [];
  }

  const windowStartMin = config.windowStartHour * 60;
  const windowEndMin = config.windowEndHour * 60;

  if (windowEndMin <= windowStartMin || shiftMin > windowEndMin - windowStartMin) {
    return [];
  }

  const out: ReplayShiftTurnoOption[] = [];
  for (let t = windowStartMin; t + shiftMin <= windowEndMin; t += shiftMin) {
    const start = minutesToClock(t);
    const end = minutesToClock(t + shiftMin);
    out.push({ value: start, label: `${start} - ${end}` });
  }
  return out;
}

export function buildReplayShiftTurnos(): ReplayShiftTurnoOption[] {
  return buildReplayShiftTurnosFromConfig(getDefaultReplayShiftConfigFromEnv());
}
