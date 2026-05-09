import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../config/env.js';

const execFileAsync = promisify(execFile);

function ffmpegExecutable(): string {
  return env.ffmpegPath?.trim() || 'ffmpeg';
}

export async function probeFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync(ffmpegExecutable(), ['-hide_banner', '-version'], {
      timeout: 8000,
      maxBuffer: 512_000,
    });
    return true;
  } catch {
    return false;
  }
}

function runFfmpeg(args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegExecutable(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    ff.stderr?.on('data', (c: Buffer) => {
      err += c.toString();
    });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg ${label} exit ${code}: ${err.slice(-1200)}`));
      }
    });
  });
}

/**
 * Recorte MP4 compatible + marca arriba-derecha (misma convención que descarga stream).
 */
export async function encodeMp4ClipWithWatermarkFromUrl(params: {
  inputUrl: string;
  outputPath: string;
  watermarkPath: string;
  startSeconds: number;
  durationSeconds: number;
}): Promise<void> {
  await runFfmpeg(
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(params.startSeconds),
      '-i',
      params.inputUrl,
      '-i',
      params.watermarkPath,
      '-filter_complex',
      '[1:v]scale=280:-1[wm];[0:v][wm]overlay=x=W-w-24:y=24:format=auto[outv]',
      '-map',
      '[outv]',
      '-map',
      '0:a?',
      '-t',
      String(params.durationSeconds),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-profile:v',
      'high',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      params.outputPath,
    ],
    'clip+watermark',
  );
}

/** FFmpeg que escribe MP4 fragmentado por stdout (entrada HTTP/S). */
export function spawnWatermarkedMp4FromHttpInput(params: {
  inputUrl: string;
  watermarkPath: string;
}): ChildProcess {
  return spawn(
    ffmpegExecutable(),
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-rw_timeout',
      '15000000',
      '-i',
      params.inputUrl,
      '-i',
      params.watermarkPath,
      '-filter_complex',
      '[1:v]scale=280:-1[wm];[0:v][wm]overlay=x=W-w-24:y=24:format=auto[outv]',
      '-map',
      '[outv]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      'frag_keyframe+empty_moov+faststart',
      '-f',
      'mp4',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}
