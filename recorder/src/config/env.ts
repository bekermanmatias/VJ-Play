import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`[env] Falta variable obligatoria: ${name}`);
  }
  return v.trim();
}

function opt(name: string, def: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : def;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v || v.trim() === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`[env] ${name} no es numérico: "${v}"`);
  }
  return n;
}

export const env = {
  supabase: {
    url: req("SUPABASE_URL"),
    key: req("SUPABASE_KEY"),
  },
  r2: {
    accountId: req("R2_ACCOUNT_ID"),
    accessKeyId: req("R2_ACCESS_KEY_ID"),
    secretAccessKey: req("R2_SECRET_ACCESS_KEY"),
    bucket: req("R2_BUCKET_NAME"),
    endpoint: req("R2_ENDPOINT"),
    publicBaseUrl: req("R2_PUBLIC_BASE_URL").replace(/\/$/, ""),
  },
  dvr: {
    user: req("DVR_RTSP_USER"),
    password: req("DVR_RTSP_PASSWORD"),
    host: req("DVR_HOST"),
    port: num("DVR_RTSP_PORT", 554),
    urlTemplate: opt(
      "DVR_RTSP_URL_TEMPLATE",
      "rtsp://{user}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}",
    ),
  },
  tenantId: opt("TENANT_ID", "default"),
  recording: {
    segmentSeconds: num("RECORDING_SEGMENT_SECONDS", 3600),
    localBufferDir: opt("RECORDING_LOCAL_BUFFER_DIR", "/var/lib/vjplay-recorder"),
    localRetentionHours: num("RECORDING_LOCAL_RETENTION_HOURS", 24),
    windowStartHour: num("RECORDING_SHIFTS_WINDOW_START_HOUR", 9),
    windowEndHour: num("RECORDING_SHIFTS_WINDOW_END_HOUR", 24),
    timezone: opt("RECORDING_TIMEZONE", "America/Argentina/Buenos_Aires"),
    videoMode: opt("RECORDING_VIDEO_MODE", "copy") as "copy" | "h264",
  },
  ffmpeg: {
    path: opt("FFMPEG_PATH", "ffmpeg"),
    ffprobePath: opt("FFPROBE_PATH", "ffprobe"),
  },
  heartbeat: {
    intervalSeconds: num("RECORDER_HEARTBEAT_INTERVAL_SECONDS", 30),
    hostLabel: opt("RECORDER_HOST_LABEL", ""),
  },
  logLevel: opt("LOG_LEVEL", "info"),
} as const;

export type AppEnv = typeof env;
