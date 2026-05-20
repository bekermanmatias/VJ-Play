import { createHash, randomInt } from 'node:crypto';
import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';
import {
  normalizeAccessCode,
  normalizeMatchKey,
} from '../utils/normalize-replay-access.js';
import {
  signReplaySessionToken,
  verifyReplaySessionToken,
} from './replay-session-token.js';
import {
  deleteReplayClipForMatch,
  getReplayClipStorageRowForMatch,
  listReplayClipsByMatchKey,
  updateReplayClipLabelForMatch,
} from './replay-clips.service.js';
import {
  getObjectStreamFromR2,
  getPresignedGetObjectDownloadUrl,
  getPresignedGetObjectReadUrl,
} from './storage.service.js';
import {
  probeFfmpegAvailable,
  spawnWatermarkedMp4FromHttpInput,
  watermarkPngExists,
} from './ffmpeg-watermark-video.service.js';
import {
  signWatermarkedStreamToken,
  verifyWatermarkedStreamToken,
} from './replay-download-stream-token.js';

type DevEntry = { matchKey: string; code: string };
type AdminMatchRow = {
  matchKey: string;
  numericId: number;
  court: string;
  date: string;
  shift: string;
  videoUrl: string;
  videoUpdatedAt: string | null;
  code: string | null;
  codeUpdatedAt: string | null;
};

function parseDevEntries(raw: string | undefined): DevEntry[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: DevEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const matchKey = (row as { matchKey?: unknown }).matchKey;
      const code = (row as { code?: unknown }).code;
      if (typeof matchKey === 'string' && typeof code === 'string') {
        out.push({ matchKey, code });
      }
    }
    return out;
  } catch {
    return [];
  }
}

const devEntries = parseDevEntries(env.devMatchAccessRaw);

function hashStoredToken(normalizedCode: string): string {
  return createHash('sha256')
    .update(`${env.jwtSessionSecret}|${normalizedCode}`, 'utf8')
    .digest('hex');
}

function numericIdFromMatchKey(matchKey: string): number {
  const digest = createHash('sha256').update(matchKey, 'utf8').digest('hex');
  // 9 dígitos estables para búsquedas operativas en mostrador.
  return Number.parseInt(digest.slice(0, 12), 16) % 1_000_000_000;
}

function splitMatchKey(matchKey: string): { court: string; date: string; shift: string } {
  const parts = matchKey.split('|');
  return {
    court: parts[0] ?? '',
    date: parts[1] ?? '',
    shift: parts[2] ?? '',
  };
}

function sanitizeReplayFilenameSegment(raw: string): string {
  const s = raw.trim();
  if (!s) {
    return '';
  }
  const out = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return out;
}

/** Fragmento `cancha-fecha-hora` alineado al front (`match_key` normalizado). */
function matchKeyToDownloadStem(mk: string): string {
  const normalized = normalizeMatchKey(mk);
  const { court, date, shift } = splitMatchKey(normalized);
  const parts = [court, date, shift].map(sanitizeReplayFilenameSegment).filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join('-') : 'partido';
}

function buildRandomAccessCode(): string {
  // Evita caracteres ambiguos (0/O, 1/I/L) para minimizar errores por WhatsApp.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = randomInt(0, alphabet.length);
    out += alphabet[idx];
  }
  return out;
}

async function generateUniqueReplayCode(params: {
  maxAttempts?: number;
} = {}): Promise<{ normalizedCode: string; tokenHash: string }> {
  const sb = getSupabase();
  const maxAttempts = params.maxAttempts ?? 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const normalizedCode = normalizeAccessCode(buildRandomAccessCode());
    const tokenHash = hashStoredToken(normalizedCode);
    const { data: clash, error: clashErr } = await sb
      .from('match_access_codes')
      .select('id')
      .eq('token_hash', tokenHash)
      .eq('revoked', false)
      .limit(1);
    if (clashErr) {
      console.error('[replay-code-clash-check]', clashErr.message);
      throw new HttpError(503, 'No se pudo generar el código');
    }
    if (!clash || clash.length === 0) {
      return { normalizedCode, tokenHash };
    }
  }
  throw new HttpError(503, 'No se pudo generar un código único');
}

async function ensureReplayCodeForMatch(
  matchKey: string,
): Promise<{ code: string; generatedAt: string; numericId: number }> {
  const mk = normalizeMatchKey(matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }
  const sb = getSupabase();
  const numericId = numericIdFromMatchKey(mk);
  const { data: existingCode, error: existingErr } = await sb
    .from('replay_match_codes')
    .select('plain_code,updated_at,numeric_id')
    .eq('match_key', mk)
    .maybeSingle();
  if (existingErr && existingErr.code !== '42P01') {
    console.error('[replay-code-existing]', existingErr.message);
    throw new HttpError(503, 'No se pudo validar el código existente');
  }

  if (existingCode?.plain_code && typeof existingCode.plain_code === 'string') {
    const normalizedCode = normalizeAccessCode(existingCode.plain_code);
    const tokenHash = hashStoredToken(normalizedCode);
    const { data: hashRow, error: hashErr } = await sb
      .from('match_access_codes')
      .select('id')
      .eq('match_key', mk)
      .eq('token_hash', tokenHash)
      .eq('revoked', false)
      .maybeSingle();
    if (hashErr) {
      console.error('[replay-code-existing-hash]', hashErr.message);
      throw new HttpError(503, 'No se pudo validar el código de acceso');
    }
    if (!hashRow) {
      const { error: insertHashErr } = await sb.from('match_access_codes').insert({
        match_key: mk,
        token_hash: tokenHash,
        expires_at: null,
        revoked: false,
      });
      if (insertHashErr) {
        console.error('[replay-code-repair-hash]', insertHashErr.message);
        throw new HttpError(503, 'No se pudo reparar el acceso del partido');
      }
    }
    const storedNumericId =
      typeof (existingCode as { numeric_id?: unknown }).numeric_id === 'number'
        ? ((existingCode as { numeric_id: number }).numeric_id as number)
        : null;
    if (!storedNumericId) {
      const { error: numericErr } = await sb
        .from('replay_match_codes')
        .update({ numeric_id: numericId })
        .eq('match_key', mk);
      if (numericErr) {
        console.error('[replay-code-fill-numeric-id]', numericErr.message);
        throw new HttpError(503, 'No se pudo guardar el ID del partido');
      }
    }
    return {
      code: normalizedCode,
      numericId: storedNumericId ?? numericId,
      generatedAt:
        typeof existingCode.updated_at === 'string'
          ? existingCode.updated_at
          : new Date().toISOString(),
    };
  }

  const generatedAt = new Date().toISOString();
  const generated = await generateUniqueReplayCode();
  const { error: insertErr } = await sb.from('match_access_codes').insert({
    match_key: mk,
    token_hash: generated.tokenHash,
    expires_at: null,
    revoked: false,
  });
  if (insertErr) {
    console.error('[replay-code-insert-hash]', insertErr.message);
    throw new HttpError(503, 'No se pudo guardar el código automático');
  }
  const { error: upsertErr } = await sb.from('replay_match_codes').upsert(
    {
      match_key: mk,
      plain_code: generated.normalizedCode,
      updated_at: generatedAt,
      numeric_id: numericId,
    },
    { onConflict: 'match_key' },
  );
  if (upsertErr) {
    console.error('[replay-code-upsert-visible]', upsertErr.message);
    throw new HttpError(503, 'No se pudo guardar el código visible');
  }
  return { code: generated.normalizedCode, generatedAt, numericId };
}

async function supabaseHasValidCode(
  matchKey: string,
  tokenHash: string,
): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('match_access_codes')
    .select('expires_at')
    .eq('match_key', matchKey)
    .eq('token_hash', tokenHash)
    .eq('revoked', false)
    .maybeSingle();

  if (error) {
    console.error('[replay-access]', error.message);
    throw new HttpError(503, 'No se pudo validar el código (base de datos)');
  }

  if (!data) {
    return false;
  }

  if (data.expires_at) {
    const exp = new Date(data.expires_at).getTime();
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      return false;
    }
  }

  return true;
}

async function fetchReplayAssets(matchKey: string): Promise<{
  videoUrl: string;
  posterUrl: string | null;
}> {
  if (!env.supabaseUrl || !env.supabaseKey) {
    return {
      videoUrl: env.replayFallbackVideoUrl,
      posterUrl: env.replayFallbackPosterUrl,
    };
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('replay_assets')
    .select('video_url,poster_url')
    .eq('match_key', matchKey)
    .maybeSingle();

  if (error) {
    console.error('[replay-assets]', error.message);
    throw new HttpError(503, 'No se pudo obtener el video');
  }

  if (data?.video_url && typeof data.video_url === 'string') {
    return {
      videoUrl: data.video_url,
      posterUrl:
        typeof data.poster_url === 'string' && data.poster_url.trim() !== ''
          ? data.poster_url
          : null,
    };
  }

  return {
    videoUrl: env.replayFallbackVideoUrl,
    posterUrl: env.replayFallbackPosterUrl,
  };
}

/**
 * Obtiene el tamaño del archivo remoto (HEAD o petición Range mínima).
 * Si el servidor no informa tamaño, devuelve null sin lanzar.
 */
async function probeRemoteVideoContentLength(url: string): Promise<number | null> {
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return null;
  }
  const timeoutMs = 8000;

  async function tryHead(): Promise<number | null> {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headRes = await fetch(u, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!headRes.ok) {
        return null;
      }
      const cl = headRes.headers.get('content-length');
      if (!cl) {
        return null;
      }
      const n = Number.parseInt(cl, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    } finally {
      clearTimeout(tid);
    }
  }

  async function tryRange(): Promise<number | null> {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const rangeRes = await fetch(u, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal,
      });
      const cr = rangeRes.headers.get('content-range');
      if (cr) {
        const m = /\/(\d+)\s*$/.exec(cr);
        const cap = m?.[1];
        if (cap) {
          const n = Number.parseInt(cap, 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(tid);
    }
  }

  const fromHead = await tryHead();
  if (fromHead !== null) {
    return fromHead;
  }
  return tryRange();
}

export async function verifyReplayAccessCode(params: {
  matchKey: string;
  code: string;
}): Promise<{ sessionToken: string; expiresAt: string }> {
  const mk = normalizeMatchKey(params.matchKey);
  const codeNorm = normalizeAccessCode(params.code);

  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!codeNorm || codeNorm.length < 4) {
    throw new HttpError(400, 'Código demasiado corto');
  }

  const hasSupabase = Boolean(env.supabaseUrl && env.supabaseKey);

  if (env.nodeEnv === 'production' && !hasSupabase) {
    throw new HttpError(
      503,
      'Acceso a replays no configurado: falta Supabase en producción',
    );
  }

  let accepted = false;

  if (hasSupabase) {
    accepted = await supabaseHasValidCode(mk, hashStoredToken(codeNorm));
  }

  if (!accepted && env.nodeEnv !== 'production') {
    accepted = devEntries.some((row) => {
      return (
        normalizeMatchKey(row.matchKey) === mk &&
        normalizeAccessCode(row.code) === codeNorm
      );
    });
  }

  if (!accepted) {
    throw new HttpError(401, 'Código incorrecto o vencido');
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.replaySessionTtlSeconds;
  const sessionToken = signReplaySessionToken(
    { mk, iat: now, exp },
    env.jwtSessionSecret,
  );

  return {
    sessionToken,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function getReplayStreamPayload(params: {
  authorizationHeader: string | undefined;
}): Promise<{ videoUrl: string; posterUrl: string | null; videoSizeBytes: number | null }> {
  const raw = params.authorizationHeader;
  const token =
    raw?.startsWith('Bearer ') === true ? raw.slice('Bearer '.length).trim() : '';

  if (!token) {
    throw new HttpError(401, 'Sesión requerida');
  }

  const claims = verifyReplaySessionToken(token, env.jwtSessionSecret);
  if (!claims) {
    throw new HttpError(401, 'Sesión inválida o expirada');
  }

  const assets = await fetchReplayAssets(claims.mk);
  const videoSizeBytes = await probeRemoteVideoContentLength(assets.videoUrl);
  return { ...assets, videoSizeBytes };
}

function sessionMatchKeyFromAuthorization(authorizationHeader: string | undefined): string {
  const raw = authorizationHeader;
  const token =
    raw?.startsWith('Bearer ') === true ? raw.slice('Bearer '.length).trim() : '';

  if (!token) {
    throw new HttpError(401, 'Sesión requerida');
  }
  const claims = verifyReplaySessionToken(token, env.jwtSessionSecret);
  if (!claims) {
    throw new HttpError(401, 'Sesión inválida o expirada');
  }
  return claims.mk;
}

export type ReplayClipApiRow = {
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

function mapClipRowToApi(row: Awaited<ReturnType<typeof listReplayClipsByMatchKey>>[number]): ReplayClipApiRow {
  return {
    id: row.id,
    matchKey: row.matchKey,
    clipLabel: row.clipLabel,
    sourceUrl: row.sourceUrl,
    clipUrl: row.clipUrl,
    thumbUrl: row.thumbUrl,
    startSeconds: row.startSeconds,
    durationSeconds: row.durationSeconds,
    clipSizeBytes: row.clipSizeBytes,
    createdAt: row.createdAt,
  };
}

export async function listReplayClipsForSession(params: {
  authorizationHeader: string | undefined;
}): Promise<{ clips: ReplayClipApiRow[] }> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  const rows = await listReplayClipsByMatchKey(mk);
  return { clips: rows.map(mapClipRowToApi) };
}

export async function renameReplayClipForSession(params: {
  authorizationHeader: string | undefined;
  clipId: string;
  clipLabel: string;
}): Promise<{ clip: ReplayClipApiRow }> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  const label = params.clipLabel.trim().slice(0, 120);
  if (!label) {
    throw new HttpError(400, 'clipLabel es requerido');
  }
  const updated = await updateReplayClipLabelForMatch({
    matchKey: mk,
    clipId: params.clipId,
    clipLabel: label,
  });
  if (!updated) {
    throw new HttpError(404, 'Clip no encontrado');
  }
  return { clip: mapClipRowToApi(updated) };
}

export async function deleteReplayClipForSession(params: {
  authorizationHeader: string | undefined;
  clipId: string;
}): Promise<void> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  await deleteReplayClipForMatch({ matchKey: mk, clipId: params.clipId });
}

function asciiDownloadFilename(base: string, clipId: string): string {
  const raw = base.trim() || `clip-${clipId}`;
  const ascii = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return ascii || `clip-${clipId}`;
}

function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function openReplayClipDownloadForSession(params: {
  authorizationHeader: string | undefined;
  clipId: string;
}): Promise<{
  body: NodeJS.ReadableStream;
  contentLength?: number;
  contentType: string;
  contentDisposition: string;
}> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  const row = await getReplayClipStorageRowForMatch(mk, params.clipId);
  if (!row) {
    throw new HttpError(404, 'Clip no encontrado');
  }
  const labelPart = asciiDownloadFilename(row.clipLabel ?? '', row.id);
  const stem = matchKeyToDownloadStem(mk);
  const filename = `${labelPart}-${stem}.mp4`;

  const { body, contentLength, contentType } = await getObjectStreamFromR2({
    key: row.clipKey,
  });
  return {
    body,
    contentLength,
    contentType: contentType ?? 'video/mp4',
    contentDisposition: contentDispositionAttachment(filename),
  };
}

function r2ObjectKeyFromPublicVideoUrl(videoUrl: string): string | null {
  const base = env.r2PublicBaseUrl?.replace(/\/$/, '');
  if (!base) {
    return null;
  }
  const u = videoUrl.trim();
  if (!u.startsWith(base)) {
    return null;
  }
  const key = u.slice(base.length).replace(/^\/+/, '');
  if (!key) {
    return null;
  }
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function sanitizeFullMatchDownloadFilename(raw: string): string {
  const t = raw.trim().slice(0, 160);
  if (!t) {
    return 'partido-completo.mp4';
  }
  const noPath = t.replace(/[/\\]/g, '');
  const safe = noPath.replace(/[^\w.\- \u00C0-\u024F]/g, '_').replace(/\s+/g, ' ').trim();
  if (!safe) {
    return 'partido-completo.mp4';
  }
  if (!safe.toLowerCase().endsWith('.mp4')) {
    const dot = safe.lastIndexOf('.');
    const baseOnly = dot === -1 ? safe : safe.slice(0, dot);
    return `${baseOnly || 'partido-completo'}.mp4`;
  }
  return safe;
}

/**
 * Enlace para descargar el partido completo sin pasar el archivo por el API ni por blob en el cliente:
 * URL firmada (GET) contra R2 cuando video_url coincide con R2_PUBLIC_BASE_URL; si no, URL pública directa.
 */
export async function getReplayFullVideoDownloadLinkForSession(params: {
  authorizationHeader: string | undefined;
  downloadFilename?: string;
}): Promise<{
  url: string;
  strategy: 'presigned_r2' | 'direct_url';
  expiresInSeconds: number | null;
}> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  const assets = await fetchReplayAssets(mk);
  const videoUrl = assets.videoUrl.trim();
  if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
    throw new HttpError(502, 'URL de video inválida');
  }

  const filename = sanitizeFullMatchDownloadFilename(params.downloadFilename ?? 'partido-completo.mp4');
  const disposition = contentDispositionAttachment(filename);

  const key = r2ObjectKeyFromPublicVideoUrl(videoUrl);
  const expiresIn = env.replayFullVideoPresignExpiresSeconds;

  if (key) {
    try {
      const signed = await getPresignedGetObjectDownloadUrl({
        key,
        expiresInSeconds: expiresIn,
        responseContentDisposition: disposition,
        responseContentType: 'video/mp4',
      });
      return {
        url: signed,
        strategy: 'presigned_r2',
        expiresInSeconds: expiresIn,
      };
    } catch (err) {
      if (env.nodeEnv !== 'test') {
        console.warn('[replay-full-video-presign]', err);
      }
    }
  }

  return {
    url: videoUrl,
    strategy: 'direct_url',
    expiresInSeconds: null,
  };
}

export type ReplayFullVideoDownloadPrepare =
  | {
      mode: 'watermarked';
      streamPath: string;
    }
  | {
      mode: 'direct';
      url: string;
      strategy: 'presigned_r2' | 'direct_url';
      expiresInSeconds: number | null;
    };

let ffmpegReadyCache: boolean | null = null;

/** True si hay PNG configurado, accesible y FFmpeg ejecutable. */
async function canWatermarkDownloads(): Promise<boolean> {
  const wm = env.watermarkPngPath?.trim() ?? '';
  if (!wm) return false;
  if (!(await watermarkPngExists(wm))) return false;
  if (ffmpegReadyCache === null) {
    ffmpegReadyCache = await probeFfmpegAvailable();
  }
  return ffmpegReadyCache;
}

/** Devuelve URL de origen consumible por FFmpeg (presignada cuando aplica). */
async function resolveSourceUrlForFfmpeg(videoUrlRaw: string): Promise<string> {
  const videoUrl = videoUrlRaw.trim();
  if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
    throw new HttpError(502, 'URL de video inválida');
  }
  const key = r2ObjectKeyFromPublicVideoUrl(videoUrl);
  const ttl = Math.min(3600, Math.max(120, env.replayFullVideoPresignExpiresSeconds));
  if (key) {
    try {
      return await getPresignedGetObjectReadUrl({
        key,
        expiresInSeconds: ttl,
        responseContentType: 'video/mp4',
      });
    } catch (err) {
      if (env.nodeEnv !== 'test') {
        console.warn('[replay-ffmpeg-presign]', err);
      }
    }
  }
  return videoUrl;
}

/** Streaming con marca de agua o enlace directo según haya o no PNG configurado. */
export async function prepareReplayFullVideoDownloadForSession(params: {
  authorizationHeader: string | undefined;
  downloadFilename?: string;
}): Promise<ReplayFullVideoDownloadPrepare> {
  const mk = sessionMatchKeyFromAuthorization(params.authorizationHeader);
  await fetchReplayAssets(mk);
  const filename = sanitizeFullMatchDownloadFilename(
    params.downloadFilename ?? 'partido-completo.mp4',
  );

  if (await canWatermarkDownloads()) {
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const tok = signWatermarkedStreamToken({ mk, fn: filename, exp }, env.jwtSessionSecret);
    return {
      mode: 'watermarked',
      streamPath: `/api/replays/access/full-video/watermarked-stream?token=${encodeURIComponent(tok)}`,
    };
  }

  const direct = await getReplayFullVideoDownloadLinkForSession(params);
  return {
    mode: 'direct',
    url: direct.url,
    strategy: direct.strategy,
    expiresInSeconds: direct.expiresInSeconds,
  };
}

/** Stream con marca aplicada on-the-fly para el partido completo (autorizado por token corto). */
export async function openReplayFullVideoWatermarkedDownloadForSession(params: {
  token: string | undefined;
}): Promise<{
  body: NodeJS.ReadableStream;
  contentType: string;
  contentDisposition: string;
}> {
  const rawTok = params.token?.trim();
  if (!rawTok) {
    throw new HttpError(400, 'token requerido');
  }
  const claims = verifyWatermarkedStreamToken(rawTok, env.jwtSessionSecret);
  if (!claims) {
    throw new HttpError(401, 'Enlace inválido o vencido');
  }
  const wmPath = env.watermarkPngPath?.trim() ?? '';
  if (!wmPath || !(await watermarkPngExists(wmPath))) {
    throw new HttpError(503, 'Marca de agua no configurada');
  }

  const assets = await fetchReplayAssets(claims.mk);
  const inputUrl = await resolveSourceUrlForFfmpeg(assets.videoUrl);
  const ff = spawnWatermarkedMp4FromHttpInput({ inputUrl, watermarkPath: wmPath });
  const ffOut = ff.stdout;
  if (!ffOut) {
    ff.kill('SIGKILL');
    throw new HttpError(502, 'FFmpeg no inició correctamente');
  }
  ff.stderr?.on('data', () => {});
  ff.on('error', (err) => {
    ffOut.destroy(err as Error);
  });

  return {
    body: ffOut,
    contentType: 'video/mp4',
    contentDisposition: contentDispositionAttachment(claims.fn),
  };
}

export async function replayMatchExists(params: {
  matchKey: string;
}): Promise<{ exists: boolean; numericId: number }> {
  const mk = normalizeMatchKey(params.matchKey);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  const numericId = numericIdFromMatchKey(mk);
  if (!env.supabaseUrl || !env.supabaseKey) {
    return { exists: true, numericId };
  }
  const sb = getSupabase();
  const { data: codeRow, error: codeErr } = await sb
    .from('replay_match_codes')
    .select('numeric_id')
    .eq('match_key', mk)
    .maybeSingle();
  if (codeErr && codeErr.code !== '42P01') {
    console.error('[replay-exists-numeric-id]', codeErr.message);
    throw new HttpError(503, 'No se pudo validar el ID del partido');
  }
  const numericIdFromDb =
    codeRow && typeof (codeRow as { numeric_id?: unknown }).numeric_id === 'number'
      ? ((codeRow as { numeric_id: number }).numeric_id as number)
      : null;
  const { data, error } = await sb
    .from('replay_assets')
    .select('match_key')
    .eq('match_key', mk)
    .maybeSingle();

  if (error) {
    console.error('[replay-exists]', error.message);
    throw new HttpError(503, 'No se pudo validar el partido');
  }

  return { exists: Boolean(data), numericId: numericIdFromDb ?? numericId };
}

export async function getReplayMatchByNumericId(params: {
  numericId: number;
}): Promise<{
  found: boolean;
  numericId: number;
  matchKey: string | null;
  court: string | null;
  date: string | null;
  shift: string | null;
}> {
  const id = Math.trunc(params.numericId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new HttpError(400, 'id inválido');
  }
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }
  const sb = getSupabase();
  const { data: codeRow, error: codeErr } = await sb
    .from('replay_match_codes')
    .select('match_key')
    .eq('numeric_id', id)
    .maybeSingle();
  if (codeErr) {
    console.error('[replay-by-id]', codeErr.message);
    throw new HttpError(503, 'No se pudo buscar el partido');
  }
  const matchKey = typeof codeRow?.match_key === 'string' ? codeRow.match_key : null;
  if (!matchKey) {
    return {
      found: false,
      numericId: id,
      matchKey: null,
      court: null,
      date: null,
      shift: null,
    };
  }
  const parsed = splitMatchKey(matchKey);
  return {
    found: true,
    numericId: id,
    matchKey,
    court: parsed.court || null,
    date: parsed.date || null,
    shift: parsed.shift || null,
  };
}

export async function insertReplayAccessCode(params: {
  matchKey: string;
  plainCode: string;
  expiresAtIso: string | null;
}): Promise<{ tokenHash: string }> {
  const mk = normalizeMatchKey(params.matchKey);
  const codeNorm = normalizeAccessCode(params.plainCode);
  if (!mk || mk.split('|').length < 3) {
    throw new HttpError(400, 'matchKey inválido');
  }
  if (!codeNorm || codeNorm.length < 4) {
    throw new HttpError(400, 'Código demasiado corto');
  }

  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }

  const sb = getSupabase();
  const tokenHash = hashStoredToken(codeNorm);

  const { error } = await sb.from('match_access_codes').insert({
    match_key: mk,
    token_hash: tokenHash,
    expires_at: params.expiresAtIso,
    revoked: false,
  });

  if (error) {
    console.error('[replay-access-insert]', error.message);
    throw new HttpError(400, 'No se pudo crear el código (¿duplicado?)');
  }

  return { tokenHash };
}

export async function listReplayMatchesForAdmin(params: {
  query: string;
}): Promise<{ matches: AdminMatchRow[] }> {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Supabase no configurado');
  }

  const q = params.query.trim().toLowerCase();
  const sb = getSupabase();
  const { data: assets, error: assetsErr } = await sb
    .from('replay_assets')
    .select('match_key,video_url,updated_at')
    .order('updated_at', { ascending: false })
    .limit(300);

  if (assetsErr) {
    console.error('[replay-admin-list-assets]', assetsErr.message);
    throw new HttpError(503, 'No se pudo listar los partidos');
  }

  // Política: código automático al detectarse un partido con replay (sin acciones manuales en admin).
  for (const row of assets ?? []) {
    const matchKey = typeof row?.match_key === 'string' ? row.match_key : '';
    if (!matchKey) continue;
    await ensureReplayCodeForMatch(matchKey);
  }

  const { data: codeRows, error: codeErr } = await sb
    .from('replay_match_codes')
    .select('match_key,plain_code,updated_at,numeric_id');

  // Permite listar partidos aunque todavía no exista la tabla nueva.
  if (codeErr && codeErr.code !== '42P01') {
    console.error('[replay-admin-list-codes]', codeErr.message);
    throw new HttpError(503, 'No se pudo listar los códigos');
  }

  const codeMap = new Map<
    string,
    { code: string; updatedAt: string | null; numericId: number | null }
  >();
  for (const row of codeRows ?? []) {
    if (!row?.match_key || typeof row.match_key !== 'string') continue;
    codeMap.set(row.match_key, {
      code: typeof row.plain_code === 'string' ? row.plain_code : '',
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
      numericId: typeof row.numeric_id === 'number' ? row.numeric_id : null,
    });
  }

  const rows: AdminMatchRow[] = [];
  for (const row of assets ?? []) {
    const matchKey = typeof row.match_key === 'string' ? row.match_key : '';
    if (!matchKey) continue;
    const parsed = splitMatchKey(matchKey);
    const linked = codeMap.get(matchKey);
    const numericId = linked?.numericId ?? numericIdFromMatchKey(matchKey);
    const searchable = [
      matchKey,
      parsed.court,
      parsed.date,
      parsed.shift,
      String(numericId),
    ]
      .join(' ')
      .toLowerCase();
    if (q && !searchable.includes(q)) continue;
    rows.push({
      matchKey,
      numericId,
      court: parsed.court,
      date: parsed.date,
      shift: parsed.shift,
      videoUrl: typeof row.video_url === 'string' ? row.video_url : '',
      videoUpdatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
      code: linked?.code || null,
      codeUpdatedAt: linked?.updatedAt ?? null,
    });
  }

  return { matches: rows };
}
