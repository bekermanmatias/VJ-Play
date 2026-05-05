import { config as loadDotenv } from 'dotenv';

loadDotenv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variable de entorno requerida ausente: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

const r2AccountId = requireEnv('R2_ACCOUNT_ID');

const defaultCorsOrigins = [
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return defaultCorsOrigins;
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseReplaySessionTtlSeconds(): number {
  const raw = process.env.REPLAY_SESSION_TTL_SECONDS;
  if (!raw || raw.trim() === '') {
    return 86_400;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 300 || n > 86400 * 14) {
    throw new Error(
      'REPLAY_SESSION_TTL_SECONDS debe ser un entero entre 300 y 1209600 (14 días)',
    );
  }
  return n;
}

export const env = {
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  jwtSessionSecret: requireEnv('JWT_SESSION_SECRET'),
  adminSecret: optionalEnv('ADMIN_SECRET'),
  corsOrigins: parseCorsOrigins(optionalEnv('CORS_ORIGINS')),
  replaySessionTtlSeconds: parseReplaySessionTtlSeconds(),
  devMatchAccessRaw: optionalEnv('DEV_MATCH_ACCESS'),

  supabaseUrl: optionalEnv('SUPABASE_URL'),
  supabaseKey: optionalEnv('SUPABASE_KEY'),

  r2AccountId,
  r2AccessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  r2BucketName: requireEnv('R2_BUCKET_NAME'),
  r2Endpoint:
    optionalEnv('R2_ENDPOINT') ??
    `https://${r2AccountId}.r2.cloudflarestorage.com`,
  r2PublicBaseUrl: optionalEnv('R2_PUBLIC_BASE_URL'),

  ffmpegPath: optionalEnv('FFMPEG_PATH'),
  ffprobePath: optionalEnv('FFPROBE_PATH'),
  watermarkPngPath: optionalEnv('WATERMARK_PNG_PATH'),
  defaultRtspUrl: optionalEnv('DEFAULT_RTSP_URL'),

  replayFallbackVideoUrl:
    optionalEnv('REPLAY_FALLBACK_VIDEO_URL') ??
    'https://archive.org/download/fourteenhours1951/Fourteen%20Hours%20(1951%2C%20USA)%20Featuring%20Richard%20Basehart%2C%20Paul%20Douglas%20-%20Film%20Noir%20Full%20Movie.mp4',
  replayFallbackPosterUrl:
    optionalEnv('REPLAY_FALLBACK_POSTER_URL') ??
    'https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=1400&q=70',
} as const;
