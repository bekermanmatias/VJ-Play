import { spawn } from 'node:child_process';
import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';

export type RtspProbeResult = {
  ok: boolean;
  video?: {
    codec: string;
    width: number;
    height: number;
  };
  error?: string;
  probedAt: string;
};

function ffprobeBin(): string {
  return env.ffprobePath ?? 'ffprobe';
}

function parseProbeJson(stdout: string): RtspProbeResult['video'] | undefined {
  let parsed: { streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }> };
  try {
    parsed = JSON.parse(stdout) as typeof parsed;
  } catch {
    return undefined;
  }
  const stream = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!stream?.width || !stream?.height) {
    return undefined;
  }
  return {
    codec: stream.codec_name ?? 'unknown',
    width: stream.width,
    height: stream.height,
  };
}

/** Prueba conectividad RTSP con ffprobe (sin grabar). */
export function probeRtspStream(rtspUrl: string, timeoutMs = 12_000): Promise<RtspProbeResult> {
  const probedAt = new Date().toISOString();
  const bin = ffprobeBin();

  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-v',
      'error',
      '-rtsp_transport',
      'tcp',
      '-timeout',
      '5000000',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_type,codec_name,width,height',
      '-of',
      'json',
      rtspUrl,
    ];

    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: err.message.includes('ENOENT')
          ? `ffprobe no encontrado (${bin}). Configurá FFPROBE_PATH en backend/.env`
          : err.message,
        probedAt,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        const video = parseProbeJson(stdout);
        if (video) {
          resolve({ ok: true, video, probedAt });
          return;
        }
        resolve({
          ok: false,
          error: 'Conexión OK pero no se detectó stream de video',
          probedAt,
        });
        return;
      }
      const msg = stderr.trim() || stdout.trim() || `ffprobe salió con código ${code ?? '?'}`;
      resolve({ ok: false, error: msg.slice(-400), probedAt });
    });
  });
}

export async function probeRtspStreamOrThrow(rtspUrl: string): Promise<RtspProbeResult> {
  const result = await probeRtspStream(rtspUrl);
  if (!result.ok) {
    throw new HttpError(502, result.error ?? 'No se pudo conectar al RTSP');
  }
  return result;
}
