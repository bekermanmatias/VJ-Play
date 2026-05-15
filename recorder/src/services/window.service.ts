import { env } from "../config/env.js";

/**
 * Devuelve la hora local (0..23) en la timezone configurada.
 * Usa Intl para no traer una librería de timezones.
 */
export function currentLocalHour(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.recording.timezone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(h);
}

/** Verifica si estamos dentro de la ventana horaria del club. */
export function isWithinRecordingWindow(now: Date = new Date()): boolean {
  const h = currentLocalHour(now);
  const start = env.recording.windowStartHour;
  const end = env.recording.windowEndHour;
  if (start === end) return true;
  if (start < end) {
    return h >= start && h < end;
  }
  // ventana que cruza medianoche (ej. 22..6)
  return h >= start || h < end;
}

/** Segundos hasta que arranca/termina la ventana actual. Para usar setTimeout. */
export function secondsUntilNextWindowChange(now: Date = new Date()): number {
  for (let i = 1; i <= 24 * 60; i++) {
    const future = new Date(now.getTime() + i * 60_000);
    if (isWithinRecordingWindow(future) !== isWithinRecordingWindow(now)) {
      return i * 60;
    }
  }
  return 60;
}
