import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';
import { deleteObjectFromR2 } from './storage.service.js';
import { normalizeMatchKey } from '../utils/normalize-replay-access.js';

export type ReplayClipRow = {
  id: string;
  matchKey: string;
  clipLabel: string | null;
  sourceUrl: string;
  clipUrl: string;
  thumbUrl: string | null;
  startSeconds: number;
  durationSeconds: number;
  clipSizeBytes: number | null;
  createdAt: string;
};

export async function insertReplayClipRecord(params: {
  matchKey: string;
  clipLabel: string | null;
  sourceUrl: string;
  clipUrl: string;
  clipKey: string;
  thumbUrl: string | null;
  startSeconds: number;
  durationSeconds: number;
  clipSizeBytes: number | null;
}): Promise<string | null> {
  const mk = normalizeMatchKey(params.matchKey);
  if (!mk || mk.split('|').length < 3) {
    return null;
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    return null;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_clips')
    .insert({
      match_key: mk,
      clip_label: params.clipLabel,
      source_url: params.sourceUrl,
      clip_url: params.clipUrl,
      clip_key: params.clipKey,
      thumb_url: params.thumbUrl,
      start_seconds: params.startSeconds,
      duration_seconds: params.durationSeconds,
      clip_size_bytes: params.clipSizeBytes,
    })
    .select('id')
    .single();
  if (error) {
    // Tabla nueva aún no aplicada o error transitorio: no romper el flujo de generación.
    if (error.code === '42P01') {
      return null;
    }
    console.error('[replay-clips-insert]', error.message);
    return null;
  }
  const id = data && typeof (data as { id?: unknown }).id === 'string' ? (data as { id: string }).id : null;
  return id;
}

export type ReplayClipStorageRow = ReplayClipRow & { clipKey: string };

function objectKeyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url || !env.r2PublicBaseUrl) {
    return null;
  }
  const base = env.r2PublicBaseUrl.replace(/\/$/, '');
  const u = url.trim();
  if (!u.startsWith(base)) {
    return null;
  }
  const key = u.slice(base.length).replace(/^\//, '');
  return key.length > 0 ? key : null;
}

export async function getReplayClipStorageRowForMatch(
  matchKey: string,
  clipId: string,
): Promise<ReplayClipStorageRow | null> {
  const mk = normalizeMatchKey(matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    return null;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_clips')
    .select(
      'id,match_key,clip_label,source_url,clip_url,clip_key,thumb_url,start_seconds,duration_seconds,clip_size_bytes,created_at',
    )
    .eq('match_key', mk)
    .eq('id', clipId)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      return null;
    }
    console.error('[replay-clips-get]', error.message);
    throw new HttpError(503, 'No se pudo leer el clip');
  }
  if (!data) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const rowMatchKey = typeof row.match_key === 'string' ? row.match_key : '';
  const clipKey = typeof row.clip_key === 'string' ? row.clip_key : '';
  const clipLabel =
    typeof row.clip_label === 'string' && row.clip_label.trim() !== ''
      ? row.clip_label
      : null;
  const sourceUrl = typeof row.source_url === 'string' ? row.source_url : '';
  const clipUrl = typeof row.clip_url === 'string' ? row.clip_url : '';
  const thumbUrl =
    typeof row.thumb_url === 'string' && row.thumb_url.trim() !== '' ? row.thumb_url : null;
  const startSeconds = typeof row.start_seconds === 'number' ? row.start_seconds : 0;
  const durationSeconds = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0;
  const clipSizeBytes =
    typeof row.clip_size_bytes === 'number' ? row.clip_size_bytes : null;
  const createdAt =
    typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  if (!id || !rowMatchKey || !sourceUrl || !clipUrl || !clipKey || durationSeconds <= 0) {
    return null;
  }
  return {
    id,
    matchKey: rowMatchKey,
    clipLabel,
    sourceUrl,
    clipUrl,
    clipKey,
    thumbUrl,
    startSeconds,
    durationSeconds,
    clipSizeBytes,
    createdAt,
  };
}

export async function updateReplayClipLabelForMatch(params: {
  matchKey: string;
  clipId: string;
  clipLabel: string | null;
}): Promise<ReplayClipRow | null> {
  const mk = normalizeMatchKey(params.matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_clips')
    .update({ clip_label: params.clipLabel })
    .eq('match_key', mk)
    .eq('id', params.clipId)
    .select(
      'id,match_key,clip_label,source_url,clip_url,thumb_url,start_seconds,duration_seconds,clip_size_bytes,created_at',
    )
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      throw new HttpError(503, 'Tabla de clips no disponible');
    }
    console.error('[replay-clips-update]', error.message);
    throw new HttpError(503, 'No se pudo renombrar el clip');
  }
  if (!data) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const rowMatchKey = typeof row.match_key === 'string' ? row.match_key : '';
  const clipLabel =
    typeof row.clip_label === 'string' && row.clip_label.trim() !== ''
      ? row.clip_label
      : null;
  const sourceUrl = typeof row.source_url === 'string' ? row.source_url : '';
  const clipUrl = typeof row.clip_url === 'string' ? row.clip_url : '';
  const thumbUrl =
    typeof row.thumb_url === 'string' && row.thumb_url.trim() !== '' ? row.thumb_url : null;
  const startSeconds = typeof row.start_seconds === 'number' ? row.start_seconds : 0;
  const durationSeconds = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0;
  const clipSizeBytes =
    typeof row.clip_size_bytes === 'number' ? row.clip_size_bytes : null;
  const createdAt =
    typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  if (!id || !rowMatchKey || !sourceUrl || !clipUrl || durationSeconds <= 0) {
    return null;
  }
  return {
    id,
    matchKey: rowMatchKey,
    clipLabel,
    sourceUrl,
    clipUrl,
    thumbUrl,
    startSeconds,
    durationSeconds,
    clipSizeBytes,
    createdAt,
  };
}

export async function deleteReplayClipForMatch(params: {
  matchKey: string;
  clipId: string;
}): Promise<void> {
  const row = await getReplayClipStorageRowForMatch(params.matchKey, params.clipId);
  if (!row) {
    throw new HttpError(404, 'Clip no encontrado');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }
  const sb = getSupabase();
  const { error } = await sb.from('replay_clips').delete().eq('match_key', row.matchKey).eq('id', row.id);
  if (error) {
    if (error.code === '42P01') {
      throw new HttpError(503, 'Tabla de clips no disponible');
    }
    console.error('[replay-clips-delete]', error.message);
    throw new HttpError(503, 'No se pudo borrar el clip');
  }

  const thumbKey = objectKeyFromPublicUrl(row.thumbUrl);
  try {
    await deleteObjectFromR2(row.clipKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[replay-clips-delete-r2-clip]', msg);
  }
  if (thumbKey) {
    try {
      await deleteObjectFromR2(thumbKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[replay-clips-delete-r2-thumb]', msg);
    }
  }
}

export async function listReplayClipsByMatchKey(matchKey: string): Promise<ReplayClipRow[]> {
  const mk = normalizeMatchKey(matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    return [];
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_clips')
    .select(
      'id,match_key,clip_label,source_url,clip_url,thumb_url,start_seconds,duration_seconds,clip_size_bytes,created_at',
    )
    .eq('match_key', mk)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (error.code === '42P01') {
      return [];
    }
    console.error('[replay-clips-list]', error.message);
    throw new HttpError(503, 'No se pudieron cargar los clips');
  }

  const rows: ReplayClipRow[] = [];
  for (const row of data ?? []) {
    const id = typeof row.id === 'string' ? row.id : '';
    const rowMatchKey = typeof row.match_key === 'string' ? row.match_key : '';
    const clipLabel =
      typeof row.clip_label === 'string' && row.clip_label.trim() !== ''
        ? row.clip_label
        : null;
    const sourceUrl = typeof row.source_url === 'string' ? row.source_url : '';
    const clipUrl = typeof row.clip_url === 'string' ? row.clip_url : '';
    const thumbUrl =
      typeof row.thumb_url === 'string' && row.thumb_url.trim() !== ''
        ? row.thumb_url
        : null;
    const startSeconds =
      typeof row.start_seconds === 'number' ? row.start_seconds : 0;
    const durationSeconds =
      typeof row.duration_seconds === 'number' ? row.duration_seconds : 0;
    const clipSizeBytes =
      typeof row.clip_size_bytes === 'number' ? row.clip_size_bytes : null;
    const createdAt =
      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
    if (!id || !rowMatchKey || !sourceUrl || !clipUrl || durationSeconds <= 0) {
      continue;
    }
    rows.push({
      id,
      matchKey: rowMatchKey,
      clipLabel,
      sourceUrl,
      clipUrl,
      thumbUrl,
      startSeconds,
      durationSeconds,
      clipSizeBytes,
      createdAt,
    });
  }
  return rows;
}
