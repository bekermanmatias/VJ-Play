import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { getR2BucketName, getS3Client } from '../config/s3.js';
import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../errors/http-error.js';

/** Cantidad máxima de imágenes por noticia (UI + validación). */
export const NEWS_MAX_IMAGES = 5;

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,200}$/;
const CATEGORY_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,127}$/;

export type NewsCategory = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export type NewsImage = {
  id: string;
  url: string;
  key: string | null;
  isMain: boolean;
  sortOrder: number;
  altText: string | null;
};

export type NewsRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  author: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categories: NewsCategory[];
  images: NewsImage[];
  /** URL de la imagen principal o primera disponible (atajo para listados). */
  mainImageUrl: string | null;
};

export type NewsListFilters = {
  categorySlug?: string;
  limit?: number;
  page?: number;
  includeDrafts?: boolean;
  search?: string;
};

export type NewsUpsertInput = {
  title: string;
  slug?: string;
  summary?: string;
  body?: string;
  author?: string | null;
  published?: boolean;
  publishedAt?: string | null;
  categorySlugs?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureSupabaseReady(): void {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new HttpError(503, 'Noticias no disponibles: falta configuración de Supabase');
  }
}

function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

async function generateUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const sb = getSupabase();
  const seed = slugify(base) || `noticia-${Date.now()}`;
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? seed : `${seed}-${i + 1}`;
    const { data, error } = await sb
      .from('news')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) {
      console.error('[news-slug]', error.message);
      throw new HttpError(503, 'No se pudo generar el slug de la noticia');
    }
    if (!data || data.id === ignoreId) {
      return candidate;
    }
  }
  return `${seed}-${randomUUID().slice(0, 8)}`;
}

function rowToNews(
  row: NewsRowDb,
  imagesByNews: Map<string, NewsImage[]>,
  categoriesByNews: Map<string, NewsCategory[]>,
): NewsRow {
  const images = imagesByNews.get(row.id) ?? [];
  const main = images.find((i) => i.isMain) ?? images[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? '',
    body: row.body ?? '',
    author: row.author ?? null,
    published: Boolean(row.published),
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categories: categoriesByNews.get(row.id) ?? [],
    images,
    mainImageUrl: main ? main.url : null,
  };
}

type NewsRowDb = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  author: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type NewsImageRowDb = {
  id: string;
  news_id: string;
  image_url: string;
  image_key: string | null;
  is_main: boolean;
  sort_order: number;
  alt_text: string | null;
};

type NewsCategoryRowDb = {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
  active: boolean;
};

type NewsCategoryLinkRowDb = {
  news_id: string;
  category_id: string;
};

async function loadRelatedForNews(newsIds: string[]): Promise<{
  imagesByNews: Map<string, NewsImage[]>;
  categoriesByNews: Map<string, NewsCategory[]>;
}> {
  const imagesByNews = new Map<string, NewsImage[]>();
  const categoriesByNews = new Map<string, NewsCategory[]>();
  if (newsIds.length === 0) {
    return { imagesByNews, categoriesByNews };
  }

  const sb = getSupabase();

  const { data: imgs, error: imgErr } = await sb
    .from('news_images')
    .select('id,news_id,image_url,image_key,is_main,sort_order,alt_text')
    .in('news_id', newsIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (imgErr) {
    console.error('[news-images]', imgErr.message);
    throw new HttpError(503, 'No se pudieron leer las imágenes de las noticias');
  }
  for (const row of (imgs ?? []) as NewsImageRowDb[]) {
    const list = imagesByNews.get(row.news_id) ?? [];
    list.push({
      id: row.id,
      url: row.image_url,
      key: row.image_key,
      isMain: Boolean(row.is_main),
      sortOrder: row.sort_order ?? 0,
      altText: row.alt_text,
    });
    imagesByNews.set(row.news_id, list);
  }

  const { data: links, error: linkErr } = await sb
    .from('news_category_links')
    .select('news_id,category_id')
    .in('news_id', newsIds);

  if (linkErr) {
    console.error('[news-cat-links]', linkErr.message);
    throw new HttpError(503, 'No se pudieron leer las categorías de las noticias');
  }
  const linkRows = (links ?? []) as NewsCategoryLinkRowDb[];
  const categoryIds = Array.from(new Set(linkRows.map((l) => l.category_id)));

  let categoriesById = new Map<string, NewsCategory>();
  if (categoryIds.length > 0) {
    const { data: cats, error: catErr } = await sb
      .from('news_categories')
      .select('id,slug,label,sort_order,active')
      .in('id', categoryIds);
    if (catErr) {
      console.error('[news-cat-rows]', catErr.message);
      throw new HttpError(503, 'No se pudieron leer las categorías');
    }
    categoriesById = new Map(
      ((cats ?? []) as NewsCategoryRowDb[]).map((c) => [
        c.id,
        {
          id: c.id,
          slug: c.slug,
          label: c.label,
          sortOrder: c.sort_order ?? 0,
          active: Boolean(c.active),
        },
      ]),
    );
  }

  for (const link of linkRows) {
    const cat = categoriesById.get(link.category_id);
    if (!cat) continue;
    const list = categoriesByNews.get(link.news_id) ?? [];
    list.push(cat);
    categoriesByNews.set(link.news_id, list);
  }
  for (const [id, list] of categoriesByNews) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    categoriesByNews.set(id, list);
  }

  return { imagesByNews, categoriesByNews };
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function listNewsCategories(includeInactive = false): Promise<NewsCategory[]> {
  ensureSupabaseReady();
  const sb = getSupabase();
  const query = sb
    .from('news_categories')
    .select('id,slug,label,sort_order,active')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  const { data, error } = includeInactive ? await query : await query.eq('active', true);

  if (error) {
    console.error('[news-categories]', error.message);
    throw new HttpError(503, 'No se pudieron leer las categorías');
  }
  return ((data ?? []) as NewsCategoryRowDb[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    sortOrder: c.sort_order ?? 0,
    active: Boolean(c.active),
  }));
}

export async function replaceNewsCategories(
  input: { slug: string; label: string; sortOrder?: number; active?: boolean }[],
): Promise<NewsCategory[]> {
  ensureSupabaseReady();

  if (input.length === 0) {
    throw new HttpError(400, 'Debe haber al menos una categoría');
  }

  const seen = new Set<string>();
  const rows = input.map((row, i) => {
    const slug = (row.slug ?? '').trim().toLowerCase();
    const label = (row.label ?? '').trim();
    if (!CATEGORY_SLUG_RE.test(slug)) {
      throw new HttpError(
        400,
        `Slug de categoría inválido: "${row.slug}" (minúsculas, números y guiones)`,
      );
    }
    if (seen.has(slug)) {
      throw new HttpError(400, `Slug de categoría duplicado: ${slug}`);
    }
    seen.add(slug);
    if (label.length === 0 || label.length > 200) {
      throw new HttpError(400, 'Cada categoría requiere un nombre (1–200 caracteres)');
    }
    return {
      slug,
      label,
      sort_order: typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : i,
      active: row.active === undefined ? true : Boolean(row.active),
      updated_at: new Date().toISOString(),
    };
  });

  const sb = getSupabase();

  // Identificar slugs que deben quedar inactivos (no incluidos en el input → soft delete).
  const submittedSlugs = rows.map((r) => r.slug);
  if (submittedSlugs.length > 0) {
    const { error: deactivateErr } = await sb
      .from('news_categories')
      .update({ active: false, updated_at: new Date().toISOString() })
      .not('slug', 'in', `(${submittedSlugs.map((s) => `"${s}"`).join(',')})`);
    if (deactivateErr) {
      console.error('[news-categories-deactivate]', deactivateErr.message);
    }
  }

  const { error } = await sb.from('news_categories').upsert(rows, { onConflict: 'slug' });
  if (error) {
    console.error('[news-categories-upsert]', error.message);
    throw new HttpError(503, 'No se pudieron guardar las categorías');
  }

  return listNewsCategories(false);
}

// ---------------------------------------------------------------------------
// Listado / detalle
// ---------------------------------------------------------------------------

export async function listNews(filters: NewsListFilters = {}): Promise<{
  rows: NewsRow[];
  total: number;
}> {
  ensureSupabaseReady();
  const sb = getSupabase();

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Filtrar por categoría: primero traemos los news_id de esa categoría.
  let newsIdsInCategory: string[] | null = null;
  if (filters.categorySlug) {
    const slug = filters.categorySlug.trim().toLowerCase();
    if (!slug) {
      throw new HttpError(400, 'Categoría inválida');
    }
    const { data: catRow, error: catErr } = await sb
      .from('news_categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (catErr) {
      console.error('[news-list-cat]', catErr.message);
      throw new HttpError(503, 'No se pudo filtrar por categoría');
    }
    if (!catRow) {
      return { rows: [], total: 0 };
    }
    const { data: linkRows, error: linkErr } = await sb
      .from('news_category_links')
      .select('news_id')
      .eq('category_id', (catRow as { id: string }).id);
    if (linkErr) {
      console.error('[news-list-links]', linkErr.message);
      throw new HttpError(503, 'No se pudo filtrar por categoría');
    }
    newsIdsInCategory = ((linkRows ?? []) as { news_id: string }[]).map((r) => r.news_id);
    if (newsIdsInCategory.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  let query = sb
    .from('news')
    .select(
      'id,slug,title,summary,body,author,published,published_at,created_at,updated_at',
      { count: 'exact' },
    );

  if (!filters.includeDrafts) {
    query = query.eq('published', true);
    query = query.lte('published_at', new Date().toISOString());
  }

  if (newsIdsInCategory) {
    query = query.in('id', newsIdsInCategory);
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term.length > 0) {
      query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,body.ilike.%${term}%`);
    }
  }

  query = query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('[news-list]', error.message);
    throw new HttpError(503, 'No se pudieron listar las noticias');
  }

  const newsRows = (data ?? []) as NewsRowDb[];
  const { imagesByNews, categoriesByNews } = await loadRelatedForNews(newsRows.map((r) => r.id));
  const rows = newsRows.map((r) => rowToNews(r, imagesByNews, categoriesByNews));
  return { rows, total: count ?? rows.length };
}

export async function getNewsBySlug(slug: string, includeDrafts = false): Promise<NewsRow | null> {
  ensureSupabaseReady();
  const sb = getSupabase();
  let query = sb
    .from('news')
    .select('id,slug,title,summary,body,author,published,published_at,created_at,updated_at')
    .eq('slug', slug.trim().toLowerCase());
  if (!includeDrafts) {
    query = query.eq('published', true).lte('published_at', new Date().toISOString());
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[news-by-slug]', error.message);
    throw new HttpError(503, 'No se pudo leer la noticia');
  }
  if (!data) return null;
  const row = data as NewsRowDb;
  const { imagesByNews, categoriesByNews } = await loadRelatedForNews([row.id]);
  return rowToNews(row, imagesByNews, categoriesByNews);
}

export async function getNewsById(id: string): Promise<NewsRow | null> {
  ensureSupabaseReady();
  const sb = getSupabase();
  const { data, error } = await sb
    .from('news')
    .select('id,slug,title,summary,body,author,published,published_at,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[news-by-id]', error.message);
    throw new HttpError(503, 'No se pudo leer la noticia');
  }
  if (!data) return null;
  const row = data as NewsRowDb;
  const { imagesByNews, categoriesByNews } = await loadRelatedForNews([row.id]);
  return rowToNews(row, imagesByNews, categoriesByNews);
}

// ---------------------------------------------------------------------------
// Mutaciones admin
// ---------------------------------------------------------------------------

async function setNewsCategoriesById(newsId: string, categorySlugs: string[]): Promise<void> {
  const sb = getSupabase();
  const slugs = Array.from(new Set(categorySlugs.map((s) => s.trim().toLowerCase()).filter(Boolean)));
  if (slugs.length === 0) {
    await sb.from('news_category_links').delete().eq('news_id', newsId);
    return;
  }
  const { data, error } = await sb
    .from('news_categories')
    .select('id,slug')
    .in('slug', slugs);
  if (error) {
    console.error('[news-set-cats]', error.message);
    throw new HttpError(503, 'No se pudieron asignar las categorías');
  }
  const ids = ((data ?? []) as { id: string; slug: string }[]).map((c) => c.id);
  await sb.from('news_category_links').delete().eq('news_id', newsId);
  if (ids.length === 0) return;
  const rows = ids.map((id) => ({ news_id: newsId, category_id: id }));
  const { error: insErr } = await sb.from('news_category_links').insert(rows);
  if (insErr) {
    console.error('[news-set-cats-ins]', insErr.message);
    throw new HttpError(503, 'No se pudieron asignar las categorías');
  }
}

export async function createNews(input: NewsUpsertInput): Promise<NewsRow> {
  ensureSupabaseReady();
  const title = (input.title ?? '').trim();
  if (!title) {
    throw new HttpError(400, 'El título es obligatorio');
  }
  const slugInput = (input.slug ?? '').trim().toLowerCase();
  if (slugInput && !SLUG_RE.test(slugInput)) {
    throw new HttpError(400, 'Slug inválido (minúsculas, números y guiones)');
  }
  const slug = slugInput ? await generateUniqueSlug(slugInput) : await generateUniqueSlug(title);

  const sb = getSupabase();
  const nowIso = new Date().toISOString();
  const published = Boolean(input.published);
  const publishedAt = input.publishedAt ?? (published ? nowIso : null);

  const { data, error } = await sb
    .from('news')
    .insert({
      slug,
      title,
      summary: (input.summary ?? '').trim(),
      body: (input.body ?? '').trim(),
      author: input.author ?? null,
      published,
      published_at: publishedAt,
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[news-create]', error.message);
    throw new HttpError(503, 'No se pudo crear la noticia');
  }

  const newsId = (data as { id: string }).id;
  if (input.categorySlugs && input.categorySlugs.length > 0) {
    await setNewsCategoriesById(newsId, input.categorySlugs);
  }

  const created = await getNewsById(newsId);
  if (!created) {
    throw new HttpError(503, 'No se pudo leer la noticia recién creada');
  }
  return created;
}

export async function updateNews(id: string, input: NewsUpsertInput): Promise<NewsRow> {
  ensureSupabaseReady();
  const existing = await getNewsById(id);
  if (!existing) {
    throw new HttpError(404, 'Noticia no encontrada');
  }

  const title = (input.title ?? existing.title).trim();
  if (!title) {
    throw new HttpError(400, 'El título es obligatorio');
  }

  let slug = existing.slug;
  if (input.slug !== undefined) {
    const candidate = input.slug.trim().toLowerCase();
    if (!candidate) {
      throw new HttpError(400, 'Slug inválido');
    }
    if (!SLUG_RE.test(candidate)) {
      throw new HttpError(400, 'Slug inválido (minúsculas, números y guiones)');
    }
    if (candidate !== existing.slug) {
      slug = await generateUniqueSlug(candidate, id);
    }
  }

  const sb = getSupabase();
  const nowIso = new Date().toISOString();
  const published = input.published !== undefined ? Boolean(input.published) : existing.published;
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : published && !existing.publishedAt
        ? nowIso
        : existing.publishedAt;

  const { error } = await sb
    .from('news')
    .update({
      slug,
      title,
      summary: input.summary !== undefined ? input.summary.trim() : existing.summary,
      body: input.body !== undefined ? input.body.trim() : existing.body,
      author: input.author !== undefined ? input.author : existing.author,
      published,
      published_at: publishedAt,
      updated_at: nowIso,
    })
    .eq('id', id);

  if (error) {
    console.error('[news-update]', error.message);
    throw new HttpError(503, 'No se pudo actualizar la noticia');
  }

  if (input.categorySlugs !== undefined) {
    await setNewsCategoriesById(id, input.categorySlugs);
  }

  const updated = await getNewsById(id);
  if (!updated) {
    throw new HttpError(503, 'No se pudo leer la noticia actualizada');
  }
  return updated;
}

export async function deleteNews(id: string): Promise<void> {
  ensureSupabaseReady();
  const existing = await getNewsById(id);
  if (!existing) {
    return;
  }
  for (const img of existing.images) {
    if (img.key) {
      try {
        await getS3Client().send(
          new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: img.key }),
        );
      } catch (err) {
        console.warn('[news-delete-r2]', img.key, err);
      }
    }
  }
  const sb = getSupabase();
  const { error } = await sb.from('news').delete().eq('id', id);
  if (error) {
    console.error('[news-delete]', error.message);
    throw new HttpError(503, 'No se pudo eliminar la noticia');
  }
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function addNewsImage(params: {
  newsId: string;
  buffer: Buffer;
  mimeType: string;
  altText?: string | null;
  setAsMain?: boolean;
}): Promise<NewsImage> {
  ensureSupabaseReady();
  if (!ALLOWED_IMAGE_MIME.has(params.mimeType)) {
    throw new HttpError(400, 'Formato de imagen no permitido (JPG, PNG o WebP)');
  }
  const existing = await getNewsById(params.newsId);
  if (!existing) {
    throw new HttpError(404, 'Noticia no encontrada');
  }
  if (existing.images.length >= NEWS_MAX_IMAGES) {
    throw new HttpError(400, `Máximo ${NEWS_MAX_IMAGES} imágenes por noticia`);
  }

  // Re-encode a JPEG y redimensiona suave para limitar peso.
  const processed = await sharp(params.buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const imageId = randomUUID();
  const key = `news/${existing.id}/${imageId}.jpg`;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: processed,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const url = env.r2PublicBaseUrl
    ? `${env.r2PublicBaseUrl.replace(/\/$/, '')}/${key}`
    : `${env.r2Endpoint.replace(/\/$/, '')}/${env.r2BucketName}/${key}`;

  const sb = getSupabase();
  const isMainRequested = Boolean(params.setAsMain) || existing.images.length === 0;

  if (isMainRequested && existing.images.some((i) => i.isMain)) {
    const { error: unsetErr } = await sb
      .from('news_images')
      .update({ is_main: false })
      .eq('news_id', existing.id)
      .eq('is_main', true);
    if (unsetErr) {
      console.warn('[news-image-unset-main]', unsetErr.message);
    }
  }

  const sortOrder = existing.images.length;
  const { data, error } = await sb
    .from('news_images')
    .insert({
      id: imageId,
      news_id: existing.id,
      image_url: url,
      image_key: key,
      is_main: isMainRequested,
      sort_order: sortOrder,
      alt_text: params.altText ?? null,
    })
    .select('id,news_id,image_url,image_key,is_main,sort_order,alt_text')
    .single();

  if (error || !data) {
    console.warn('[news-image-insert]', error?.message);
    try {
      await getS3Client().send(
        new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
      );
    } catch {
      // ignore cleanup failure
    }
    throw new HttpError(503, 'No se pudo guardar la imagen');
  }

  const row = data as NewsImageRowDb;
  return {
    id: row.id,
    url: row.image_url,
    key: row.image_key,
    isMain: Boolean(row.is_main),
    sortOrder: row.sort_order ?? 0,
    altText: row.alt_text,
  };
}

export async function setNewsImageMain(newsId: string, imageId: string): Promise<NewsRow> {
  ensureSupabaseReady();
  const sb = getSupabase();
  const { data: targetRow, error: tgtErr } = await sb
    .from('news_images')
    .select('id')
    .eq('news_id', newsId)
    .eq('id', imageId)
    .maybeSingle();
  if (tgtErr) {
    console.error('[news-img-main-find]', tgtErr.message);
    throw new HttpError(503, 'No se pudo marcar la imagen principal');
  }
  if (!targetRow) {
    throw new HttpError(404, 'Imagen no encontrada');
  }
  const { error: unsetErr } = await sb
    .from('news_images')
    .update({ is_main: false })
    .eq('news_id', newsId)
    .eq('is_main', true);
  if (unsetErr) {
    console.error('[news-img-main-unset]', unsetErr.message);
    throw new HttpError(503, 'No se pudo marcar la imagen principal');
  }
  const { error: setErr } = await sb
    .from('news_images')
    .update({ is_main: true })
    .eq('id', imageId);
  if (setErr) {
    console.error('[news-img-main-set]', setErr.message);
    throw new HttpError(503, 'No se pudo marcar la imagen principal');
  }
  const updated = await getNewsById(newsId);
  if (!updated) {
    throw new HttpError(404, 'Noticia no encontrada');
  }
  return updated;
}

export async function deleteNewsImage(newsId: string, imageId: string): Promise<NewsRow> {
  ensureSupabaseReady();
  const sb = getSupabase();
  const { data: imgRow, error: imgErr } = await sb
    .from('news_images')
    .select('id,is_main,image_key')
    .eq('news_id', newsId)
    .eq('id', imageId)
    .maybeSingle();
  if (imgErr) {
    console.error('[news-img-del-find]', imgErr.message);
    throw new HttpError(503, 'No se pudo eliminar la imagen');
  }
  if (!imgRow) {
    throw new HttpError(404, 'Imagen no encontrada');
  }
  const wasMain = Boolean((imgRow as { is_main: boolean }).is_main);
  const key = (imgRow as { image_key: string | null }).image_key;
  if (key) {
    try {
      await getS3Client().send(
        new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
      );
    } catch (err) {
      console.warn('[news-img-del-r2]', key, err);
    }
  }
  const { error: delErr } = await sb.from('news_images').delete().eq('id', imageId);
  if (delErr) {
    console.error('[news-img-del]', delErr.message);
    throw new HttpError(503, 'No se pudo eliminar la imagen');
  }
  // Si era la principal, promovemos la primera que quede.
  if (wasMain) {
    const { data: first } = await sb
      .from('news_images')
      .select('id')
      .eq('news_id', newsId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first) {
      await sb.from('news_images').update({ is_main: true }).eq('id', (first as { id: string }).id);
    }
  }
  const updated = await getNewsById(newsId);
  if (!updated) {
    throw new HttpError(404, 'Noticia no encontrada');
  }
  return updated;
}
