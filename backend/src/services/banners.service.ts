import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { getR2BucketName, getS3Client } from '../config/s3.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  buttonLabel: string;
  buttonUrl: string;
  openInNewTab: boolean;
  imageUrl: string;
  imageKey: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HomeBannerUpsertInput = {
  title: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  openInNewTab?: boolean;
  active?: boolean;
  sortOrder?: number;
};

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

type HomeBannerRowDb = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  button_label: string;
  button_url: string;
  open_in_new_tab: boolean;
  image_url: string;
  image_key: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureSupabaseReady(): void {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Banners no disponibles: falta configuración de Supabase');
  }
}

function rowToBanner(row: HomeBannerRowDb): HomeBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    description: row.description ?? '',
    buttonLabel: row.button_label ?? '',
    buttonUrl: row.button_url ?? '',
    openInNewTab: Boolean(row.open_in_new_tab),
    imageUrl: row.image_url,
    imageKey: row.image_key ?? null,
    active: Boolean(row.active),
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildPublicUrl(key: string): string {
  const base = env.r2PublicBaseUrl;
  if (!base) throw new HttpError(503, 'R2_PUBLIC_BASE_URL no configurado');
  return `${base.replace(/\/$/, '')}/${key}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listBanners(opts: { includeInactive?: boolean } = {}): Promise<HomeBanner[]> {
  ensureSupabaseReady();
  const sb = getSupabase();

  let query = sb
    .from('home_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!opts.includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[home-banners-list]', error.message);
    throw new HttpError(503, 'No se pudieron leer los banners');
  }
  return ((data ?? []) as HomeBannerRowDb[]).map(rowToBanner);
}

export async function createBanner(input: HomeBannerUpsertInput): Promise<HomeBanner> {
  ensureSupabaseReady();
  if (!input.title?.trim()) throw new HttpError(400, 'El título es requerido');

  const sb = getSupabase();
  const { data, error } = await sb
    .from('home_banners')
    .insert({
      title: input.title.trim(),
      subtitle: (input.subtitle ?? '').trim(),
      description: (input.description ?? '').trim(),
      button_label: (input.buttonLabel ?? '').trim(),
      button_url: (input.buttonUrl ?? '').trim(),
      open_in_new_tab: input.openInNewTab ?? false,
      image_url: '',
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[home-banners-create]', error?.message);
    throw new HttpError(503, 'No se pudo crear el banner');
  }
  return rowToBanner(data as HomeBannerRowDb);
}

export async function updateBanner(id: string, input: Partial<HomeBannerUpsertInput>): Promise<HomeBanner> {
  ensureSupabaseReady();
  const sb = getSupabase();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.buttonLabel !== undefined) patch.button_label = input.buttonLabel.trim();
  if (input.buttonUrl !== undefined) patch.button_url = input.buttonUrl.trim();
  if (input.openInNewTab !== undefined) patch.open_in_new_tab = input.openInNewTab;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { data, error } = await sb
    .from('home_banners')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[home-banners-update]', error?.message);
    throw new HttpError(503, 'No se pudo actualizar el banner');
  }
  return rowToBanner(data as HomeBannerRowDb);
}

export async function deleteBanner(id: string): Promise<void> {
  ensureSupabaseReady();
  const sb = getSupabase();

  // Intentar borrar imagen de R2 si existe
  const { data: existing } = await sb
    .from('home_banners')
    .select('image_key')
    .eq('id', id)
    .maybeSingle();

  if (existing?.image_key) {
    try {
      const client = getS3Client();
      await client.send(new DeleteObjectCommand({
        Bucket: getR2BucketName(),
        Key: existing.image_key,
      }));
    } catch (e) {
      console.warn('[home-banners-delete-r2]', e);
    }
  }

  const { error } = await sb.from('home_banners').delete().eq('id', id);
  if (error) {
    console.error('[home-banners-delete]', error.message);
    throw new HttpError(503, 'No se pudo eliminar el banner');
  }
}

export async function uploadBannerImage(id: string, buffer: Buffer, mimetype: string): Promise<HomeBanner> {
  ensureSupabaseReady();
  const sb = getSupabase();

  // Optimizar imagen
  const optimized = await sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const key = `home-banners/${id}/${randomUUID()}.jpg`;
  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    Body: optimized,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }));

  const imageUrl = buildPublicUrl(key);

  // Eliminar imagen anterior en R2
  const { data: existing } = await sb
    .from('home_banners')
    .select('image_key')
    .eq('id', id)
    .maybeSingle();
  if (existing?.image_key && existing.image_key !== key) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: existing.image_key }));
    } catch (e) {
      console.warn('[home-banners-upload-old-cleanup]', e);
    }
  }

  const { data, error } = await sb
    .from('home_banners')
    .update({ image_url: imageUrl, image_key: key, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[home-banners-upload]', error?.message);
    throw new HttpError(503, 'No se pudo guardar la imagen del banner');
  }
  return rowToBanner(data as HomeBannerRowDb);
}
