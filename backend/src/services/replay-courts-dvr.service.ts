import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

/**
 * Servicio admin para gestionar el mapeo cancha → canal del DVR Dahua.
 *
 * Vista distinta de `replay-courts.service.ts` (público): aquí incluimos
 * las columnas que sólo le interesan al admin / al recorder.
 */

export type CourtDvrRow = {
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
  dvrChannel: number | null;
  dvrSubtype: number;
  rtspUrlOverride: string | null;
  recordingEnabled: boolean;
};

interface RawRow {
  slug: string;
  label: string;
  sort_order: number | null;
  active: boolean | null;
  dvr_channel: number | null;
  dvr_subtype: number | null;
  rtsp_url_override: string | null;
  recording_enabled: boolean | null;
}

function toCourtDvrRow(r: RawRow): CourtDvrRow {
  return {
    slug: r.slug,
    label: r.label,
    sortOrder: Number(r.sort_order ?? 0),
    active: r.active ?? true,
    dvrChannel: r.dvr_channel,
    dvrSubtype: r.dvr_subtype ?? 0,
    rtspUrlOverride: r.rtsp_url_override,
    recordingEnabled: r.recording_enabled ?? false,
  };
}

function ensureSupabase(): void {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no está configurado en el backend');
  }
}

export async function listCourtsWithDvr(): Promise<CourtDvrRow[]> {
  ensureSupabase();
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_courts')
    .select(
      'slug, label, sort_order, active, dvr_channel, dvr_subtype, rtsp_url_override, recording_enabled',
    )
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true });

  if (error) {
    console.error('[replay-courts-dvr]', error.message);
    throw new HttpError(503, 'No se pudo leer la configuración de canchas');
  }
  const rows = (data ?? []) as RawRow[];
  return rows.map(toCourtDvrRow);
}

export interface UpdateCourtDvrInput {
  dvrChannel?: number | null;
  dvrSubtype?: number | null;
  rtspUrlOverride?: string | null;
  recordingEnabled?: boolean | null;
}

export async function updateCourtDvr(
  slug: string,
  input: UpdateCourtDvrInput,
): Promise<CourtDvrRow> {
  ensureSupabase();
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) {
    throw new HttpError(400, 'slug requerido');
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (Object.prototype.hasOwnProperty.call(input, 'dvrChannel')) {
    if (input.dvrChannel === null || input.dvrChannel === undefined) {
      update.dvr_channel = null;
    } else {
      const n = Number(input.dvrChannel);
      if (!Number.isInteger(n) || n < 1 || n > 64) {
        throw new HttpError(400, 'dvrChannel debe ser entero entre 1 y 64');
      }
      update.dvr_channel = n;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'dvrSubtype')) {
    const n = input.dvrSubtype === null || input.dvrSubtype === undefined ? 0 : Number(input.dvrSubtype);
    if (!Number.isInteger(n) || n < 0 || n > 3) {
      throw new HttpError(400, 'dvrSubtype debe ser 0..3 (0 = mainstream)');
    }
    update.dvr_subtype = n;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'rtspUrlOverride')) {
    const raw = input.rtspUrlOverride;
    if (raw === null || raw === undefined || raw === '') {
      update.rtsp_url_override = null;
    } else if (typeof raw !== 'string') {
      throw new HttpError(400, 'rtspUrlOverride debe ser string');
    } else {
      const trimmed = raw.trim();
      if (!/^rtsp:\/\//i.test(trimmed)) {
        throw new HttpError(400, 'rtspUrlOverride debe empezar con rtsp://');
      }
      if (trimmed.length > 1024) {
        throw new HttpError(400, 'rtspUrlOverride demasiado largo');
      }
      update.rtsp_url_override = trimmed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'recordingEnabled')) {
    update.recording_enabled = !!input.recordingEnabled;
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_courts')
    .update(update)
    .eq('slug', cleanSlug)
    .select(
      'slug, label, sort_order, active, dvr_channel, dvr_subtype, rtsp_url_override, recording_enabled',
    )
    .maybeSingle();

  if (error) {
    console.error('[replay-courts-dvr]', error.message);
    throw new HttpError(503, 'No se pudo actualizar la cancha');
  }
  if (!data) {
    throw new HttpError(404, `Cancha "${cleanSlug}" no encontrada`);
  }
  return toCourtDvrRow(data as RawRow);
}
