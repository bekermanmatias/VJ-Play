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

function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (!v || v.trim() === "") return def;
  const t = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(t)) return true;
  if (["0", "false", "no", "off"].includes(t)) return false;
  throw new Error(`[env] ${name} debe ser booleano (true/false / 1/0), recibí: "${v}"`);
}

/**
 * Dónde corre el proceso: desarrollo en tu PC vs VPS con túnel al Mikrotik.
 * - local (default): no envía heartbeats a Supabase salvo RECORDER_ALLOW_HEARTBEAT_IN_LOCAL=true
 * - vps: producción; heartbeats y operación normal
 */
function parseVjRuntime(raw: string | undefined): "local" | "vps" {
  const t = (raw ?? "local").trim().toLowerCase();
  if (t === "vps" || t === "production" || t === "prod") return "vps";
  if (t === "local" || t === "development" || t === "dev") return "local";
  throw new Error(
    `[env] VJ_RUNTIME debe ser local|vps (o dev|prod). Recibí: "${raw ?? ""}"`,
  );
}

export const env = {
  /** Modo de despliegue: no confundir ensayo en PC con el recorder del VPS. */
  runtime: (() => {
    const mode = parseVjRuntime(process.env.VJ_RUNTIME);
    const allowHeartbeatInLocal = bool("RECORDER_ALLOW_HEARTBEAT_IN_LOCAL", false);
    return {
      mode,
      isLocal: mode === "local",
      isVps: mode === "vps",
      /** En local, ¿mandar heartbeats igual? (default false) */
      allowHeartbeatInLocal,
      /** Heartbeat habilitado si vps, o local con flag explícito */
      shouldSendHeartbeat: mode === "vps" || allowHeartbeatInLocal,
    };
  })(),
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
