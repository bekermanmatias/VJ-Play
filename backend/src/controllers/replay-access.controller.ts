import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  getReplayStreamPayload,
  insertReplayAccessCode,
  verifyReplayAccessCode,
} from '../services/replay-access.service.js';

export const postReplayAccessVerify = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { matchKey?: unknown; code?: unknown };
  const matchKey = typeof body.matchKey === 'string' ? body.matchKey : '';
  const code = typeof body.code === 'string' ? body.code : '';
  const result = await verifyReplayAccessCode({ matchKey, code });
  res.json(result);
});

export const getReplayAccessStream = asyncHandler(async (req: Request, res: Response) => {
  const payload = await getReplayStreamPayload({
    authorizationHeader: req.header('authorization'),
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

export const postReplayAccessCodes = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    matchKey?: unknown;
    plainCode?: unknown;
    expiresAt?: unknown;
  };
  const matchKey = typeof body.matchKey === 'string' ? body.matchKey : '';
  const plainCode = typeof body.plainCode === 'string' ? body.plainCode : '';
  const expiresAt =
    typeof body.expiresAt === 'string' && body.expiresAt.trim() !== ''
      ? body.expiresAt.trim()
      : null;

  const row = await insertReplayAccessCode({
    matchKey,
    plainCode,
    expiresAtIso: expiresAt,
  });

  res.status(201).json({ ok: true, tokenHash: row.tokenHash });
});
