import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import {
  listCourtsWithDvr,
  updateCourtDvr,
  type UpdateCourtDvrInput,
} from '../services/replay-courts-dvr.service.js';
import { listRecorderHeartbeats } from '../services/recorder-heartbeat.service.js';

export const getCourtsDvr = asyncHandler(async (_req: Request, res: Response) => {
  const courts = await listCourtsWithDvr();
  res.json({ courts });
});

export const patchCourtDvr = asyncHandler(async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? '').trim();
  if (!slug) {
    throw new HttpError(400, 'slug requerido en la URL');
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  const input: UpdateCourtDvrInput = {};
  if ('dvrChannel' in body) {
    input.dvrChannel =
      body.dvrChannel === null || body.dvrChannel === ''
        ? null
        : Number(body.dvrChannel);
  }
  if ('dvrSubtype' in body) {
    input.dvrSubtype =
      body.dvrSubtype === null || body.dvrSubtype === ''
        ? null
        : Number(body.dvrSubtype);
  }
  if ('rtspUrlOverride' in body) {
    input.rtspUrlOverride =
      body.rtspUrlOverride === null
        ? null
        : typeof body.rtspUrlOverride === 'string'
          ? body.rtspUrlOverride
          : null;
  }
  if ('recordingEnabled' in body) {
    input.recordingEnabled = !!body.recordingEnabled;
  }

  const updated = await updateCourtDvr(slug, input);
  res.json({ court: updated });
});

export const getRecorderStatus = asyncHandler(async (_req: Request, res: Response) => {
  const courts = await listRecorderHeartbeats();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ courts });
});
