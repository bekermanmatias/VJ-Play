import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { access } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

const FFMPEG_BIN = env.ffmpegPath ?? 'ffmpeg';

/**
 * Marca anclada por el borde inferior (el texto queda más abajo en el cuadro).
 * PNG 2000×1500 → se escala manteniendo 4:3 dentro de la caja máx. ancho × alto.
 */
function overlayFilter(): string {
  const xPct = env.watermarkXPercent;
  const bottomPct = env.watermarkBottomPercent;
  const wPct = env.watermarkWidthPercent;
  const hPct = env.watermarkMaxHeightPercent;
  const xExpr = `(W*${xPct}-w*50)/100`;
  const yExpr = `(H*${bottomPct}/100-h)`;

  if (wPct > 0 && hPct > 0) {
    return `[1:v][0:v]scale2ref=w=ref_w*${wPct}/100:h=ref_h*${hPct}/100:force_original_aspect_ratio=decrease[wm][base];[base][wm]overlay=x=${xExpr}:y=${yExpr}:format=auto[outv]`;
  }
  if (wPct > 0) {
    return `[1:v][0:v]scale2ref=w=ref_w*${wPct}/100:h=-1[wm][base];[base][wm]overlay=x=${xExpr}:y=${yExpr}:format=auto[outv]`;
  }
  return `[0:v][1:v]overlay=x=${xExpr}:y=${yExpr}:format=auto[outv]`;
}

let ffmpegProbeCache: boolean | null = null;

/** Verifica que el binario FFmpeg sea ejecutable (cacheado). */
export async function probeFfmpegAvailable(): Promise<boolean> {
  if (ffmpegProbeCache !== null) {
    return ffmpegProbeCache;
  }
  ffmpegProbeCache = await new Promise<boolean>((resolve) => {
    const proc = spawn(FFMPEG_BIN, ['-version'], { stdio: 'ignore' });
    proc.once('error', () => resolve(false));
    proc.once('exit', (code) => resolve(code === 0));
  });
  return ffmpegProbeCache;
}

/** Verifica que el PNG de marca exista y sea legible. */
export async function watermarkPngExists(path: string | undefined): Promise<boolean> {
  if (!path || path.trim() === '') {
    return false;
  }
  try {
    await access(path.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Codifica un clip H.264/AAC con marca de agua superpuesta.
 * Output a archivo (faststart para reproducción inmediata).
 */
export async function encodeMp4ClipWithWatermarkFromUrl(params: {
  inputUrl: string;
  outputPath: string;
  watermarkPath: string;
  startSeconds: number;
  durationSeconds: number;
}): Promise<void> {
  const args = [
    '-y',
    '-ss', String(Math.max(0, params.startSeconds)),
    '-i', params.inputUrl,
    '-i', params.watermarkPath,
    '-t', String(Math.max(0.01, params.durationSeconds)),
    '-filter_complex', overlayFilter(),
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    params.outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 4096) stderr = stderr.slice(-4096);
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.trim().slice(-512)}`));
    });
  });
}

/**
 * Inicia FFmpeg que toma input HTTP, aplica marca y emite MP4 fragmentado por stdout.
 */
export function spawnWatermarkedMp4FromHttpInput(params: {
  inputUrl: string;
  watermarkPath: string;
}): ChildProcessByStdio<null, Readable, Readable> {
  const args = [
    '-loglevel', 'error',
    '-i', params.inputUrl,
    '-i', params.watermarkPath,
    '-filter_complex', overlayFilter(),
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1',
  ];

  return spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
}
