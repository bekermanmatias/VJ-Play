import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import {
  NEWS_MAX_IMAGES,
  addNewsImage,
  createNews,
  deleteNews,
  deleteNewsImage,
  getNewsBySlug,
  getNewsById,
  listNews,
  listNewsCategories,
  replaceNewsCategories,
  setNewsImageMain,
  updateNews,
} from '../services/news.service.js';
import { firstRouteParam } from '../utils/route-params.js';

function parseStringList(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) {
    return input.filter((v): v is string => typeof v === 'string');
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------------

export const getNewsList = asyncHandler(async (req: Request, res: Response) => {
  const categorySlug =
    typeof req.query.category === 'string' && req.query.category.trim() !== ''
      ? req.query.category.trim().toLowerCase()
      : undefined;
  const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const page = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await listNews({
    categorySlug,
    limit: Number.isFinite(limit) ? (limit as number) : undefined,
    page: Number.isFinite(page) ? (page as number) : undefined,
    search,
  });
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ news: result.rows, total: result.total });
});

export const getNewsDetail = asyncHandler(async (req: Request, res: Response) => {
  const slug = firstRouteParam(req.params.slug) ?? '';
  if (!slug) throw new HttpError(400, 'slug requerido');
  const news = await getNewsBySlug(slug);
  if (!news) throw new HttpError(404, 'Noticia no encontrada');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ news });
});

export const getNewsCategoriesPublic = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listNewsCategories(false);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ categories });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminListNews = asyncHandler(async (req: Request, res: Response) => {
  const categorySlug =
    typeof req.query.category === 'string' && req.query.category.trim() !== ''
      ? req.query.category.trim().toLowerCase()
      : undefined;
  const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const page = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await listNews({
    categorySlug,
    limit: Number.isFinite(limit) ? (limit as number) : 50,
    page: Number.isFinite(page) ? (page as number) : undefined,
    includeDrafts: true,
    search,
  });
  res.json({ news: result.rows, total: result.total });
});

export const adminGetNews = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  const news = await getNewsById(id);
  if (!news) throw new HttpError(404, 'Noticia no encontrada');
  res.json({ news });
});

export const adminCreateNews = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const news = await createNews({
    title: typeof body.title === 'string' ? body.title : '',
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
    author: typeof body.author === 'string' ? body.author : null,
    published: typeof body.published === 'boolean' ? body.published : false,
    publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : null,
    categorySlugs: parseStringList(body.categorySlugs),
  });
  res.status(201).json({ news });
});

export const adminUpdateNews = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  const body = (req.body ?? {}) as Record<string, unknown>;
  const news = await updateNews(id, {
    title: typeof body.title === 'string' ? body.title : '',
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
    author: typeof body.author === 'string' ? body.author : undefined,
    published: typeof body.published === 'boolean' ? body.published : undefined,
    publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : undefined,
    categorySlugs: parseStringList(body.categorySlugs),
  });
  res.json({ news });
});

export const adminDeleteNews = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  await deleteNews(id);
  res.status(204).send();
});

export const adminUploadNewsImage = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; size: number } }).file;
  if (!file) {
    throw new HttpError(400, 'Archivo de imagen requerido (campo "image")');
  }
  if (file.size === 0) {
    throw new HttpError(400, 'Archivo vacío');
  }
  const setAsMain = req.body && (req.body as Record<string, unknown>).setAsMain === 'true';
  const altText = req.body && typeof (req.body as Record<string, unknown>).altText === 'string'
    ? ((req.body as Record<string, unknown>).altText as string)
    : null;
  const image = await addNewsImage({
    newsId: id,
    buffer: file.buffer,
    mimeType: file.mimetype,
    setAsMain,
    altText,
  });
  res.status(201).json({ image, maxImages: NEWS_MAX_IMAGES });
});

export const adminSetNewsImageMain = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  const imageId = firstRouteParam(req.params.imageId) ?? '';
  if (!id || !imageId) throw new HttpError(400, 'Parámetros faltantes');
  const news = await setNewsImageMain(id, imageId);
  res.json({ news });
});

export const adminDeleteNewsImage = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  const imageId = firstRouteParam(req.params.imageId) ?? '';
  if (!id || !imageId) throw new HttpError(400, 'Parámetros faltantes');
  const news = await deleteNewsImage(id, imageId);
  res.json({ news });
});

export const adminListCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listNewsCategories(true);
  res.json({ categories });
});

export const adminReplaceCategories = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { categories?: unknown };
  if (!Array.isArray(body.categories)) {
    throw new HttpError(400, 'Body inválido: se espera { categories: [...] }');
  }
  const parsed = body.categories.map((row, idx) => {
    if (!row || typeof row !== 'object') {
      throw new HttpError(400, 'Cada categoría debe ser un objeto');
    }
    const o = row as Record<string, unknown>;
    return {
      slug: typeof o.slug === 'string' ? o.slug : '',
      label: typeof o.label === 'string' ? o.label : '',
      sortOrder:
        typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : idx,
      active: typeof o.active === 'boolean' ? o.active : true,
    };
  });
  const categories = await replaceNewsCategories(parsed);
  res.json({ categories });
});
