import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import { getReplayCourts, replaceReplayCourts } from '../services/replay-courts.service.js';

export const getCourts = asyncHandler(async (_req: Request, res: Response) => {
  const payload = await getReplayCourts();
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(payload);
});

export const putCourts = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    courts?: unknown;
  };
  if (!Array.isArray(body.courts)) {
    throw new HttpError(400, 'Body inválido: se espera { courts: [...] }');
  }

  const parsed: { slug: string; label: string; sortOrder: number }[] = [];
  for (let i = 0; i < body.courts.length; i++) {
    const row = body.courts[i];
    if (!row || typeof row !== 'object') {
      throw new HttpError(400, 'Cada ítem de courts debe ser un objeto');
    }
    const o = row as Record<string, unknown>;
    const slug = typeof o.slug === 'string' ? o.slug : '';
    const label = typeof o.label === 'string' ? o.label : '';
    const sortOrder = typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : i;
    if (slug.trim() === '' || label.trim() === '') {
      throw new HttpError(400, 'Cada cancha requiere slug y label');
    }
    parsed.push({ slug: slug.trim(), label: label.trim(), sortOrder });
  }

  const payload = await replaceReplayCourts(parsed);
  res.json(payload);
});
