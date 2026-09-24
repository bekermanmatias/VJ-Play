import {
  type ReplayShiftConfig,
  getDefaultReplayShiftConfigFromEnv,
} from "@/utils/replay-shift-turnos";
import { normalizeReplayApiBase } from "@/utils/replay-api-base";
import { adminFetchJson } from "@/utils/admin-api";

function normalizeApiResponse(json: unknown): ReplayShiftConfig {
  if (!json || typeof json !== "object") {
    return getDefaultReplayShiftConfigFromEnv();
  }
  const o = json as Record<string, unknown>;
  const shiftDurationSeconds = Number(o.shiftDurationSeconds);
  const windowStartHour = Number(o.windowStartHour);
  const windowEndHour = Number(o.windowEndHour);
  const src = o.source === "database" || o.source === "env" ? o.source : undefined;

  if (
    !Number.isFinite(shiftDurationSeconds) ||
    shiftDurationSeconds < 300 ||
    shiftDurationSeconds > 28_800 ||
    !Number.isFinite(windowStartHour) ||
    windowStartHour < 0 ||
    windowStartHour > 23 ||
    !Number.isFinite(windowEndHour) ||
    windowEndHour < 1 ||
    windowEndHour > 24 ||
    windowEndHour * 60 <= windowStartHour * 60
  ) {
    return getDefaultReplayShiftConfigFromEnv();
  }

  const shiftMin = Math.round(shiftDurationSeconds / 60);
  const span = windowEndHour * 60 - windowStartHour * 60;
  if (shiftMin < 1 || shiftMin > span) {
    return getDefaultReplayShiftConfigFromEnv();
  }

  return {
    shiftDurationSeconds: Math.round(shiftDurationSeconds),
    windowStartHour: Math.trunc(windowStartHour),
    windowEndHour: Math.trunc(windowEndHour),
    ...(src ? { source: src } : {}),
  };
}

/** Lee turnos desde el API (Supabase + fallback servidor); si no hay `apiBase`, usa solo env público. */
export async function loadReplayShiftConfig(apiBase: string): Promise<ReplayShiftConfig> {
  const base = normalizeReplayApiBase(apiBase);
  if (!base) {
    return getDefaultReplayShiftConfigFromEnv();
  }
  try {
    const res = await fetch(`${base}/api/replays/shift-config`);
    if (!res.ok) {
      return getDefaultReplayShiftConfigFromEnv();
    }
    const json: unknown = await res.json();
    return normalizeApiResponse(json);
  } catch {
    return getDefaultReplayShiftConfigFromEnv();
  }
}

export async function saveReplayShiftConfig(
  body: Pick<ReplayShiftConfig, "shiftDurationSeconds" | "windowStartHour" | "windowEndHour">,
): Promise<ReplayShiftConfig> {
  const parsed = await adminFetchJson<unknown>("/replays/shift-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shiftDurationSeconds: body.shiftDurationSeconds,
      windowStartHour: body.windowStartHour,
      windowEndHour: body.windowEndHour,
    }),
  });
  return normalizeApiResponse(parsed);
}
