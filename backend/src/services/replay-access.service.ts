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
import { listReplayClipsByMatchKey } from './replay-clips.service.js';

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
}): Promise<{ videoUrl: string; posterUrl: string | null }> {
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

  return fetchReplayAssets(claims.mk);
}

export async function listReplayClipsForSession(params: {
  authorizationHeader: string | undefined;
}): Promise<{
  clips: {
    id: string;
    matchKey: string;
    clipLabel: string | null;
    sourceUrl: string;
    clipUrl: string;
    startSeconds: number;
    durationSeconds: number;
    createdAt: string;
  }[];
}> {
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
  const clips = await listReplayClipsByMatchKey(claims.mk);
  return { clips };
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
