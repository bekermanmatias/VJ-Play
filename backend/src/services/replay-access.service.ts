import { createHash } from 'node:crypto';
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

type DevEntry = { matchKey: string; code: string };

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
