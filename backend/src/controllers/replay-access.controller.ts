import type { Request, Response } from 'express';
import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  deleteReplayClipForSession,
  getReplayMatchByNumericId,
  listReplayClipsForSession,
  getReplayStreamPayload,
  insertReplayAccessCode,
  listReplayMatchesForAdmin,
  openReplayClipDownloadForSession,
  openReplayFullVideoWatermarkedDownloadForSession,
  prepareReplayFullVideoDownloadForSession,
  getReplayFullVideoDownloadLinkForSession,
  replayMatchExists,
  renameReplayClipForSession,
  verifyReplayAccessCode,
} from '../services/replay-access.service.js';
import { firstRouteParam } from '../utils/route-params.js';

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

export const getReplayAccessClips = asyncHandler(async (req: Request, res: Response) => {
  const payload = await listReplayClipsForSession({
    authorizationHeader: req.header('authorization'),
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

export const patchReplayAccessClip = asyncHandler(async (req: Request, res: Response) => {
  const clipId = firstRouteParam(req.params.clipId);
  if (!clipId) {
    throw new HttpError(400, 'clipId requerido');
  }
  const body = req.body as { clipLabel?: unknown };
  const clipLabel = typeof body.clipLabel === 'string' ? body.clipLabel : '';
  const payload = await renameReplayClipForSession({
    authorizationHeader: req.header('authorization'),
    clipId,
    clipLabel,
  });
  res.json(payload);
});

export const deleteReplayAccessClip = asyncHandler(async (req: Request, res: Response) => {
  const clipId = firstRouteParam(req.params.clipId);
  if (!clipId) {
    throw new HttpError(400, 'clipId requerido');
  }
  await deleteReplayClipForSession({
    authorizationHeader: req.header('authorization'),
    clipId,
  });
  res.status(204).send();
});

export const getReplayAccessClipDownload = asyncHandler(async (req: Request, res: Response) => {
  const clipId = firstRouteParam(req.params.clipId);
  if (!clipId) {
    throw new HttpError(400, 'clipId requerido');
  }
  const { body, contentLength, contentType, contentDisposition } =
    await openReplayClipDownloadForSession({
      authorizationHeader: req.header('authorization'),
      clipId,
    });
  res.setHeader('Content-Type', contentType);
  if (contentLength !== undefined) {
    res.setHeader('Content-Length', String(contentLength));
  }
  res.setHeader('Content-Disposition', contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  body.on('error', () => {
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.destroy();
    }
  });
  body.pipe(res);
});

export const getReplayAccessFullVideoDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
  const rawName = typeof req.query.filename === 'string' ? req.query.filename : '';
  const payload = await getReplayFullVideoDownloadLinkForSession({
    authorizationHeader: req.header('authorization'),
    downloadFilename: rawName || undefined,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

export const getReplayAccessFullVideoDownloadPrepare = asyncHandler(async (req: Request, res: Response) => {
  const rawName = typeof req.query.filename === 'string' ? req.query.filename : '';
  const payload = await prepareReplayFullVideoDownloadForSession({
    authorizationHeader: req.header('authorization'),
    downloadFilename: rawName || undefined,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

export const getReplayAccessFullVideoWatermarkedStream = asyncHandler(async (req: Request, res: Response) => {
  const token =
    typeof req.query.token === 'string'
      ? req.query.token
      : typeof req.query.t === 'string'
        ? req.query.t
        : '';
  const { body, contentType, contentDisposition } =
    await openReplayFullVideoWatermarkedDownloadForSession({ token });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  body.on('error', () => {
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.destroy();
    }
  });
  body.pipe(res);
});

export const getReplayAccessExists = asyncHandler(async (req: Request, res: Response) => {
  const matchKey = typeof req.query.matchKey === 'string' ? req.query.matchKey : '';
  const payload = await replayMatchExists({ matchKey });
  res.setHeader('Cache-Control', 'no-store');
  res.json(payload);
});

export const getReplayAccessMatchById = asyncHandler(async (req: Request, res: Response) => {
  const raw = typeof req.query.id === 'string' ? req.query.id : '';
  const id = Number.parseInt(raw, 10);
  const payload = await getReplayMatchByNumericId({ numericId: id });
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

export const getReplayAdminMatches = asyncHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const payload = await listReplayMatchesForAdmin({ query });
  res.json(payload);
});
