import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { captureFrameFromVideoSource } from '../services/ffmpeg.service.js';
import { exportFrameAsJpeg } from '../services/image.service.js';
import { uploadFileToR2 } from '../services/storage.service.js';
import { delay } from '../utils/delay.js';
import { firstRouteParam } from '../utils/route-params.js';

const COURT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

function resolveTenantId(req: Request): string {
  const header = req.header('x-tenant-id');
  if (header && header.trim() !== '') {
    return header.trim();
  }
  const body = req.body as { tenantId?: unknown } | undefined;
  if (body && typeof body.tenantId === 'string' && body.tenantId.trim() !== '') {
    return body.tenantId.trim();
  }
  return 'default';
}

function resolveSourceUrl(req: Request): string | undefined {
  const body = req.body as { sourceUrl?: unknown } | undefined;
  if (body && typeof body.sourceUrl === 'string' && body.sourceUrl.trim() !== '') {
    return body.sourceUrl.trim();
  }
  return env.defaultRtspUrl;
}

/**
 * POST /api/courts/:court_id/snap
 * Simula flujo QR: espera 3s, captura frame, sube a R2.
 */
export const postCourtSnap = asyncHandler(async (req: Request, res: Response) => {
  const courtId = firstRouteParam(req.params.court_id);
  if (!courtId || !COURT_ID_RE.test(courtId)) {
    throw new HttpError(400, 'court_id inválido');
  }

  const tenantId = resolveTenantId(req);
  const sourceUrl = resolveSourceUrl(req);
  if (!sourceUrl) {
    throw new HttpError(
      400,
      'Falta sourceUrl en el body o DEFAULT_RTSP_URL en entorno',
    );
  }

  await delay(3000);

  const workDir = await mkdtemp(join(tmpdir(), 'vj-snap-'));
  const rawFrame = join(workDir, 'frame.png');
  const finalJpeg = join(workDir, 'snap.jpg');

  try {
    await captureFrameFromVideoSource(sourceUrl, rawFrame);
    await exportFrameAsJpeg(rawFrame, finalJpeg);

    const key = `${tenantId}/courts/${courtId}/snaps/${Date.now()}-${uuidv4()}.jpg`;
    const uploaded = await uploadFileToR2({
      key,
      filePath: finalJpeg,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400',
    });

    res.status(201).json({
      courtId,
      tenantId,
      objectKey: uploaded.key,
      publicUrl: uploaded.publicUrl ?? null,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
