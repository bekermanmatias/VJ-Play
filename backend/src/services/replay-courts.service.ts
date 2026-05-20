import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

export type ReplayCourtRow = {
  slug: string;
  label: string;
  sortOrder: number;
};

export type ReplayCourtsPayload = {
  courts: ReplayCourtRow[];
  source: 'database' | 'env';
};

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,127}$/;

const FALLBACK_COURTS: ReplayCourtRow[] = [
  { slug: 'cancha-padel', label: 'Cancha Padel', sortOrder: 0 },
  { slug: 'cancha-f5', label: 'Cancha F5', sortOrder: 1 },
];

const CACHE_TTL_MS = 60_000;
let cache: { value: ReplayCourtsPayload; at: number } | null = null;

function clearCourtsCache(): void {
  cache = null;
}

function envFallback(): ReplayCourtsPayload {
  return { courts: FALLBACK_COURTS, source: 'env' };
}

function normalizeSlug(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

function assertCourtsList(courts: ReplayCourtRow[]): void {
  if (courts.length === 0) {
    throw new HttpError(400, 'Debe haber al menos una cancha');
  }
  const slugs = new Set<string>();
  for (const c of courts) {
    const slug = normalizeSlug(c.slug);
    if (!SLUG_RE.test(slug)) {
      throw new HttpError(
        400,
        `slug inválido: ${c.slug} (usar minúsculas, números, guiones; máx. 128 caracteres)`,
      );
    }
    if (slugs.has(slug)) {
      throw new HttpError(400, `slug duplicado: ${slug}`);
    }
    slugs.add(slug);
    const label = typeof c.label === 'string' ? c.label.trim() : '';
    if (label === '' || label.length > 200) {
      throw new HttpError(400, 'Cada cancha necesita una etiqueta (1–200 caracteres)');
    }
  }
}

export async function getReplayCourts(): Promise<ReplayCourtsPayload> {
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
    .from('replay_courts')
    .select('slug, label, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true });

  if (error) {
    console.error('[replay-courts]', error.message);
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  if (!data?.length) {
    const value = envFallback();
    cache = { value, at: now };
    return value;
  }

  const courts: ReplayCourtRow[] = data.map((row) => ({
    slug: String(row.slug),
    label: String(row.label),
    sortOrder: Number(row.sort_order) || 0,
  }));

  const value: ReplayCourtsPayload = { courts, source: 'database' };
  cache = { value, at: now };
  return value;
}

export async function replaceReplayCourts(
  input: { slug: string; label: string; sortOrder?: number }[],
): Promise<ReplayCourtsPayload> {
  const withOrder: ReplayCourtRow[] = input.map((c, i) => ({
    slug: c.slug,
    label: c.label,
    sortOrder: typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder) ? c.sortOrder : i,
  }));

  assertCourtsList(withOrder);

  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'No se puede guardar: falta configuración de Supabase');
  }

  const sb = getSupabase();
  const { error: delErr } = await sb
    .from('replay_courts')
    .delete()
    .gte('sort_order', -2_147_483_648);

  if (delErr) {
    console.error('[replay-courts]', delErr.message);
    throw new HttpError(503, 'No se pudo actualizar la lista de canchas');
  }

  const rows = withOrder.map((c) => ({
    slug: normalizeSlug(c.slug),
    label: c.label.trim(),
    sort_order: c.sortOrder,
    active: true,
    updated_at: new Date().toISOString(),
  }));

  const { error: insErr } = await sb.from('replay_courts').insert(rows);

  if (insErr) {
    console.error('[replay-courts]', insErr.message);
    throw new HttpError(503, 'No se pudo guardar las canchas');
  }

  clearCourtsCache();
  return getReplayCourts();
}
