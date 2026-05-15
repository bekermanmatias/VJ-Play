import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

export type RecorderStatus =
  | 'recording'
  | 'idle'
  | 'error'
  | 'paused'
  | 'starting'
  | 'unknown';

export interface RecorderHeartbeatRow {
  courtSlug: string;
  courtLabel: string | null;
  /** 'unknown' cuando la cancha tiene recording_enabled=true pero nunca reportó heartbeat. */
  status: RecorderStatus;
  /** ISO. null si nunca reportó. */
  lastSeenAt: string | null;
  /** Segundos desde el último heartbeat. null si nunca reportó. */
  secondsSinceLastSeen: number | null;
  /** True si pasó más de N segundos desde el último heartbeat. */
  stale: boolean;
  currentSegmentMatchKey: string | null;
  lastSegmentMatchKey: string | null;
  lastSegmentUploadedAt: string | null;
  errorMessage: string | null;
  recordingEnabled: boolean;
}

const STALE_AFTER_SECONDS = 120;

interface RawJoin {
  slug: string;
  label: string;
  recording_enabled: boolean | null;
  recorder_heartbeat: Array<{
    last_seen_at: string | null;
    status: string | null;
    current_segment_match_key: string | null;
    last_segment_match_key: string | null;
    last_segment_uploaded_at: string | null;
    error_message: string | null;
  }> | null;
}

function ensureSupabase(): void {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no está configurado en el backend');
  }
}

function toRow(r: RawJoin): RecorderHeartbeatRow {
  const hb = r.recorder_heartbeat?.[0] ?? null;
  const lastSeen = hb?.last_seen_at ?? null;
  const secondsSince = lastSeen
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000))
    : null;
  const enabled = r.recording_enabled ?? false;

  let status: RecorderStatus;
  if (!hb || !hb.status) {
    status = enabled ? 'unknown' : 'paused';
  } else {
    const valid: RecorderStatus[] = ['recording', 'idle', 'error', 'paused', 'starting'];
    status = (valid as readonly string[]).includes(hb.status)
      ? (hb.status as RecorderStatus)
      : 'unknown';
  }

  const stale = secondsSince !== null && secondsSince > STALE_AFTER_SECONDS;

  return {
    courtSlug: r.slug,
    courtLabel: r.label ?? null,
    status,
    lastSeenAt: lastSeen,
    secondsSinceLastSeen: secondsSince,
    stale,
    currentSegmentMatchKey: hb?.current_segment_match_key ?? null,
    lastSegmentMatchKey: hb?.last_segment_match_key ?? null,
    lastSegmentUploadedAt: hb?.last_segment_uploaded_at ?? null,
    errorMessage: hb?.error_message ?? null,
    recordingEnabled: enabled,
  };
}

/**
 * Devuelve una fila por cancha (todas las que existen en `replay_courts`),
 * con su heartbeat asociado si existe. El admin se entera de canchas que
 * "deberían estar grabando y no reportan".
 */
export async function listRecorderHeartbeats(): Promise<RecorderHeartbeatRow[]> {
  ensureSupabase();
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_courts')
    .select(
      `
      slug,
      label,
      recording_enabled,
      recorder_heartbeat(
        last_seen_at,
        status,
        current_segment_match_key,
        last_segment_match_key,
        last_segment_uploaded_at,
        error_message
      )
    `,
    )
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true });

  if (error) {
    console.error('[recorder-heartbeat]', error.message);
    // Si la tabla recorder_heartbeat aún no existe (42P01) caemos a sólo canchas.
    if (error.code === '42P01') {
      return fallbackWithoutHeartbeatTable();
    }
    throw new HttpError(503, 'No se pudo leer el estado de grabación');
  }
  const rows = (data ?? []) as RawJoin[];
  return rows.map(toRow);
}

async function fallbackWithoutHeartbeatTable(): Promise<RecorderHeartbeatRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_courts')
    .select('slug, label, recording_enabled')
    .order('sort_order', { ascending: true });
  if (error) {
    throw new HttpError(503, 'No se pudo leer canchas');
  }
  return (data ?? []).map((r) => ({
    courtSlug: r.slug,
    courtLabel: r.label,
    status: r.recording_enabled ? 'unknown' : 'paused',
    lastSeenAt: null,
    secondsSinceLastSeen: null,
    stale: false,
    currentSegmentMatchKey: null,
    lastSegmentMatchKey: null,
    lastSegmentUploadedAt: null,
    errorMessage: null,
    recordingEnabled: !!r.recording_enabled,
  }));
}
