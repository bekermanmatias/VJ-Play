import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

export type ReplayShiftConfigPublic = {
  shiftDurationSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  source: 'database' | 'env';
};

const CACHE_TTL_MS = 60_000;
let cache: { value: ReplayShiftConfigPublic; at: number } | null = null;

function clearShiftConfigCache(): void {
  cache = null;
}

function envFallback(): ReplayShiftConfigPublic {
  return {
    shiftDurationSeconds: env.recordingShiftDurationSeconds,
    windowStartHour: env.recordingShiftsWindowStartHour,
    windowEndHour: env.recordingShiftsWindowEndHour,
    source: 'env',
  };
}

function assertValidConfig(parts: {
  shiftDurationSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
}): void {
  const { shiftDurationSeconds: d, windowStartHour: s, windowEndHour: e } = parts;
  if (!Number.isFinite(d) || d < 300 || d > 28_800) {
    throw new HttpError(400, 'shiftDurationSeconds debe estar entre 300 y 28800');
  }
  if (!Number.isFinite(s) || s < 0 || s > 23) {
    throw new HttpError(400, 'windowStartHour debe estar entre 0 y 23');
  }
  if (!Number.isFinite(e) || e < 1 || e > 24) {
    throw new HttpError(400, 'windowEndHour debe estar entre 1 y 24');
  }
  if (e * 60 <= s * 60) {
    throw new HttpError(400, 'windowEndHour debe ser mayor que el inicio de windowStartHour');
  }
  const shiftMin = Math.round(d / 60);
  if (shiftMin < 1 || shiftMin > e * 60 - s * 60) {
    throw new HttpError(
      400,
      'La ventana horaria es demasiado corta para la duración de turno indicada',
    );
  }
}

/**
 * Config efectiva: fila en `replay_shift_settings` si Supabase responde; si no, variables de entorno.
 * Cache en memoria (~60s) para no saturar la DB en cada carga del front.
 */
export async function getReplayShiftConfig(): Promise<ReplayShiftConfigPublic> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  if (!env.supabaseUrl || !env.supabaseKey) {
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_shift_settings')
    .select(
      'shift_duration_seconds, window_start_hour, window_end_hour',
    )
    .eq('singleton_key', 'global')
    .maybeSingle();

  if (error) {
    console.error('[replay-shift-settings]', error.message);
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  if (!data) {
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  const shiftDurationSeconds = Number(data.shift_duration_seconds);
  const windowStartHour = Number(data.window_start_hour);
  const windowEndHour = Number(data.window_end_hour);

  try {
    assertValidConfig({ shiftDurationSeconds, windowStartHour, windowEndHour });
  } catch {
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  const value: ReplayShiftConfigPublic = {
    shiftDurationSeconds,
    windowStartHour,
    windowEndHour,
    source: 'database',
  };
  cache = { value, at: now };
  return value;
}

export async function upsertReplayShiftConfig(parts: {
  shiftDurationSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
}): Promise<ReplayShiftConfigPublic> {
  assertValidConfig(parts);

  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'No se puede guardar: falta configuración de Supabase');
  }

  const sb = getSupabase();
  const { error } = await sb.from('replay_shift_settings').upsert(
    {
      singleton_key: 'global',
      shift_duration_seconds: Math.round(parts.shiftDurationSeconds),
      window_start_hour: parts.windowStartHour,
      window_end_hour: parts.windowEndHour,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'singleton_key' },
  );

  if (error) {
    console.error('[replay-shift-settings]', error.message);
    throw new HttpError(503, 'No se pudo guardar la configuración de turnos');
  }

  clearShiftConfigCache();
  return getReplayShiftConfig();
}
