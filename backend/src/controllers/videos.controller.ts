import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { runClipJob } from '../services/clip-job.service.js';
import { createClipJob, getClipJob } from '../stores/clip-jobs.store.js';
import { firstRouteParam } from '../utils/route-params.js';

interface ClipBody {
  sourceUrl?: unknown;
  startSeconds?: unknown;
  endSeconds?: unknown;
  clipLabel?: unknown;
  tenantId?: unknown;
  courtId?: unknown;
  matchId?: unknown;
  matchKey?: unknown;
}

function parseFiniteNumber(value: unknown, label: string): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) {
    throw new HttpError(400, `${label} debe ser un número válido`);
  }
  return n;
}

function resolveTenantId(req: Request, body: ClipBody): string {
  const header = req.header('x-tenant-id');
  if (header && header.trim() !== '') {
    return header.trim();
  }
  if (typeof body.tenantId === 'string' && body.tenantId.trim() !== '') {
    return body.tenantId.trim();
  }
  return 'default';
}

/**
 * POST /api/videos/clip
 * Encola recorte HEVC + subida a R2; responde 202 de inmediato.
 */
export const postVideoClip = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ClipBody;
  const sourceUrl =
    typeof body.sourceUrl === 'string' && body.sourceUrl.trim() !== ''
      ? body.sourceUrl.trim()
      : null;
  if (!sourceUrl) {
    throw new HttpError(400, 'sourceUrl es requerido');
  }

  const startSeconds = parseFiniteNumber(body.startSeconds, 'startSeconds');
  const endSeconds = parseFiniteNumber(body.endSeconds, 'endSeconds');
  if (endSeconds <= startSeconds) {
    throw new HttpError(400, 'endSeconds debe ser mayor que startSeconds');
  }

  const durationSeconds = endSeconds - startSeconds;
  const clipLabel =
    typeof body.clipLabel === 'string' && body.clipLabel.trim() !== ''
      ? body.clipLabel.trim().slice(0, 120)
      : undefined;
  const tenantId = resolveTenantId(req, body);
  const courtId =
    typeof body.courtId === 'string' && body.courtId.trim() !== ''
      ? body.courtId.trim()
      : undefined;
  const matchId =
    typeof body.matchId === 'string' && body.matchId.trim() !== ''
      ? body.matchId.trim()
      : undefined;
  const matchKey =
    typeof body.matchKey === 'string' && body.matchKey.trim() !== ''
      ? body.matchKey.trim()
      : undefined;

  const jobId = uuidv4();
  createClipJob(jobId);

  void runClipJob(jobId, {
    sourceUrl,
    startSeconds,
    durationSeconds,
    clipLabel,
    tenantId,
    courtId,
    matchId,
    matchKey,
  });

  res.status(202).json({
    jobId,
    status: 'queued' as const,
  });
});

/**
 * GET /api/videos/clip/:jobId
 * Consulta estado del trabajo asíncrono (almacenamiento en memoria; MVP).
 */
export const getVideoClipJob = asyncHandler(async (req: Request, res: Response) => {
  const jobId = firstRouteParam(req.params.jobId);
  if (!jobId) {
    throw new HttpError(400, 'jobId requerido');
  }
  const job = getClipJob(jobId);
  if (!job) {
    throw new HttpError(404, 'Trabajo de clip no encontrado');
  }
  res.json(job);
});
