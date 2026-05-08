import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { captureFrameAtTime, extractHevcMp4Clip } from './ffmpeg.service.js';
import { insertReplayClipRecord } from './replay-clips.service.js';
import { uploadFileToR2 } from './storage.service.js';
import {
  failClipJob,
  startClipJob,
  succeedClipJob,
} from '../stores/clip-jobs.store.js';

export interface ClipJobPayload {
  sourceUrl: string;
  startSeconds: number;
  durationSeconds: number;
  clipLabel?: string;
  tenantId: string;
  courtId?: string;
  matchId?: string;
  matchKey?: string;
}

/**
 * Ejecuta el pipeline de clip en segundo plano (llamar sin await desde el controlador).
 * FFmpeg y upload usan I/O y procesos hijo; el hilo principal solo orquesta callbacks.
 */
export async function runClipJob(
  jobId: string,
  payload: ClipJobPayload,
): Promise<void> {
  startClipJob(jobId);
  const workDir = await mkdtemp(join(tmpdir(), 'vj-clip-'));
  const outFile = join(workDir, `clip-${uuidv4()}.mp4`);
  const thumbFile = join(workDir, `thumb-${uuidv4()}.jpg`);

  try {
    await extractHevcMp4Clip(
      payload.sourceUrl,
      outFile,
      payload.startSeconds,
      payload.durationSeconds,
    );

    const prefix = [
      payload.tenantId,
      'videos',
      payload.courtId ? `courts/${payload.courtId}` : 'courts/unknown',
      payload.matchId ? `matches/${payload.matchId}` : 'clips',
    ].join('/');

    const key = `${prefix}/${Date.now()}-${uuidv4()}.mp4`;
    const uploaded = await uploadFileToR2({
      key,
      filePath: outFile,
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const clipStat = await stat(outFile);
    let uploadedThumb: { key: string; publicUrl?: string } | null = null;
    try {
      await captureFrameAtTime(outFile, thumbFile, 0.1);
      const thumbKey = `${prefix}/${Date.now()}-${uuidv4()}.jpg`;
      uploadedThumb = await uploadFileToR2({
        key: thumbKey,
        filePath: thumbFile,
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      });
    } catch (thumbErr) {
      if (env.nodeEnv !== 'test') {
        console.warn('[clip-job-thumb]', jobId, thumbErr);
      }
    }

    succeedClipJob(jobId, {
      resultKey: uploaded.key,
      publicUrl: uploaded.publicUrl,
    });
    if (payload.matchKey && uploaded.publicUrl) {
      await insertReplayClipRecord({
        matchKey: payload.matchKey,
        clipLabel: payload.clipLabel?.trim() || null,
        sourceUrl: payload.sourceUrl,
        clipUrl: uploaded.publicUrl,
        clipKey: uploaded.key,
        thumbUrl: uploadedThumb?.publicUrl ?? null,
        startSeconds: payload.startSeconds,
        durationSeconds: payload.durationSeconds,
        clipSizeBytes: clipStat.size,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failClipJob(jobId, message);
    if (env.nodeEnv !== 'test') {
      console.error('[clip-job]', jobId, err);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
