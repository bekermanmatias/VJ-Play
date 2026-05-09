import ffmpeg from 'fluent-ffmpeg';
import { env } from '../config/env.js';

if (env.ffmpegPath) {
  ffmpeg.setFfmpegPath(env.ffmpegPath);
}
if (env.ffprobePath) {
  ffmpeg.setFfprobePath(env.ffprobePath);
}

function isRtspUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.startsWith('rtsp://') || u.startsWith('rtsps://');
}

/**
 * Captura un fotograma desde RTSP, HLS (m3u8) u otra fuente soportada por FFmpeg.
 * Usa proceso hijo (spawn) — no bloquea el event loop de Node.
 */
export function captureFrameFromVideoSource(
  inputUrl: string,
  outputFilePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputUrl);

    if (isRtspUrl(inputUrl)) {
      command.inputOptions([
        '-rtsp_transport',
        'tcp',
        '-stimeout',
        '5000000',
      ]);
    }

    command
      .frames(1)
      .outputOptions(['-q:v', '2'])
      .output(outputFilePath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Captura un frame de una fuente de video en un tiempo específico.
 */
export function captureFrameAtTime(
  inputUrl: string,
  outputFilePath: string,
  atSeconds: number,
): Promise<void> {
  const safeTime = Number.isFinite(atSeconds) && atSeconds > 0 ? atSeconds : 0;
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputUrl);
    if (isRtspUrl(inputUrl)) {
      command.inputOptions(['-rtsp_transport', 'tcp']);
    }
    command
      .setStartTime(safeTime)
      .frames(1)
      .outputOptions([
        '-vf',
        'scale=320:-2',
        '-q:v',
        '24',
      ])
      .output(outputFilePath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Extrae un clip en MP4 con H.264 + AAC (yuv420p): reproducible en la mayoría de navegadores, móviles y TVs.
 * La decodificación/codificación ocurre en el proceso FFmpeg, no en el hilo principal.
 */
export function extractCompatibleMp4Clip(
  inputUrl: string,
  outputFilePath: string,
  startSeconds: number,
  durationSeconds: number,
): Promise<void> {
  if (durationSeconds <= 0) {
    return Promise.reject(
      new Error('durationSeconds debe ser mayor que 0'),
    );
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputUrl);

    if (isRtspUrl(inputUrl)) {
      command.inputOptions(['-rtsp_transport', 'tcp']);
    }

    command
      .setStartTime(startSeconds)
      .duration(durationSeconds)
      .outputOptions([
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
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
      ])
      .output(outputFilePath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .run();
  });
}
