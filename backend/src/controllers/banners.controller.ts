import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import {
  createBanner,
  deleteBanner,
  listBanners,
  updateBanner,
  uploadBannerImage,
} from '../services/banners.service.js';
import { firstRouteParam } from '../utils/route-params.js';

// ---------------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------------

export const getPublicBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await listBanners({ includeInactive: false });
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ banners });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminListBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await listBanners({ includeInactive: true });
  res.json({ banners });
});

export const adminCreateBanner = asyncHandler(async (req: Request, res: Response) => {
  const { title, subtitle, buttonLabel, buttonUrl, active, sortOrder } = req.body as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) {
    throw new HttpError(400, 'El campo title es requerido');
  }
  const banner = await createBanner({
    title,
    subtitle: typeof subtitle === 'string' ? subtitle : '',
    buttonLabel: typeof buttonLabel === 'string' ? buttonLabel : '',
    buttonUrl: typeof buttonUrl === 'string' ? buttonUrl : '',
    active: active === undefined ? true : Boolean(active),
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
  });
  res.status(201).json({ banner });
});

export const adminUpdateBanner = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  const { title, subtitle, buttonLabel, buttonUrl, active, sortOrder } = req.body as Record<string, unknown>;
  const banner = await updateBanner(id, {
    ...(typeof title === 'string' ? { title } : {}),
    ...(typeof subtitle === 'string' ? { subtitle } : {}),
    ...(typeof buttonLabel === 'string' ? { buttonLabel } : {}),
    ...(typeof buttonUrl === 'string' ? { buttonUrl } : {}),
    ...(active !== undefined ? { active: Boolean(active) } : {}),
    ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
  });
  res.json({ banner });
});

export const adminDeleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  await deleteBanner(id);
  res.status(204).end();
});

export const adminUploadBannerImage = asyncHandler(async (req: Request, res: Response) => {
  const id = firstRouteParam(req.params.id) ?? '';
  if (!id) throw new HttpError(400, 'id requerido');
  if (!req.file) throw new HttpError(400, 'Se requiere una imagen');
  const banner = await uploadBannerImage(id, req.file.buffer, req.file.mimetype);
  res.json({ banner });
});
