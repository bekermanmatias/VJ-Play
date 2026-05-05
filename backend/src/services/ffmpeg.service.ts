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
 * Extrae un clip en contenedor MP4 con video H.265 (HEVC) y audio AAC.
 * La decodificación/codificación ocurre en el proceso FFmpeg, no en el hilo principal.
 */
export function extractHevcMp4Clip(
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
        '-c:v',
        'libx265',
        '-preset',
        'medium',
        '-crf',
        '28',
        '-tag:v',
        'hvc1',
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
