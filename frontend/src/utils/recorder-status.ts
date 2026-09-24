/**
 * Lógica pura para describir el estado del recorder en el panel admin.
 * Sin imports de runtime: se puede testear sin montar React ni Supabase.
 */

export type RecorderStatusValue =
  | "recording"
  | "idle"
  | "error"
  | "paused"
  | "starting"
  | "unknown";

/** Subconjunto estructural de RecorderHeartbeatRow que necesita la UI. */
export interface RecorderStatusView {
  status: RecorderStatusValue;
  stale: boolean;
  recordingEnabled: boolean;
  lastSeenAt: string | null;
  secondsSinceLastSeen: number | null;
  currentSegmentStartedAt: string | null;
  currentSegmentMatchKey: string | null;
  lastSegmentMatchKey: string | null;
  lastSegmentUploadedAt: string | null;
  bytesWrittenLastSegment: number | null;
  errorMessage: string | null;
  recorderVersion: string | null;
  recorderHost: string | null;
}

export type RecorderTone = "ok" | "warn" | "error" | "idle" | "info" | "muted";

export interface RecorderBadge {
  label: string;
  tone: RecorderTone;
  spin?: boolean;
}

export interface RecorderIssue {
  title: string;
  detail: string;
  action: string;
}

/** Etiqueta + tono del badge de estado. */
export function describeRecorderBadge(
  row: RecorderStatusView | undefined,
  loading = false,
): RecorderBadge {
  if (loading) return { label: "…", tone: "muted", spin: true };
  if (!row) return { label: "Sin datos", tone: "muted" };

  switch (row.status) {
    case "recording":
      return row.stale
        ? { label: "recording (stale)", tone: "warn" }
        : { label: "recording", tone: "ok" };
    case "error":
      return { label: "error", tone: "error" };
    case "idle":
      return { label: "fuera de horario", tone: "idle" };
    case "paused":
      return { label: "deshabilitada", tone: "muted" };
    case "starting":
      return { label: "arrancando", tone: "info", spin: true };
    case "unknown":
      return { label: "sin reportar", tone: "warn" };
    default:
      return { label: String(row.status), tone: "muted" };
  }
}

function classifyErrorMessage(message: string): RecorderIssue {
  if (/no se pudo lanzar ffmpeg|ffmpeg no devolvi|spawn|ENOENT/i.test(message)) {
    return {
      title: "No se pudo iniciar FFmpeg",
      detail: message,
      action: "Revisá que FFmpeg esté instalado en el servidor del recorder y la URL RTSP de la cancha.",
    };
  }
  if (/subiendo segmento|upload|multipart|\bR2\b|\bS3\b/i.test(message)) {
    return {
      title: "Error subiendo el segmento",
      detail: message,
      action: "Verificá credenciales y espacio en R2, y reintentá la grabación.",
    };
  }
  if (/rtsp|timeout|timed out|connection refused|unreachable|401|403|unauthorized|forbidden/i.test(message)) {
    return {
      title: "Error de conexión RTSP",
      detail: message,
      action: "Probá la cámara en esta pantalla y verificá usuario/clave/canal del DVR.",
    };
  }
  if (/exited unexpectedly|ffmpeg sali|process-exit/i.test(message)) {
    return {
      title: "FFmpeg se detuvo inesperadamente",
      detail: message,
      action: "El recorder reintenta solo; si persiste, revisá el log del recorder.",
    };
  }
  return {
    title: "Error del recorder",
    detail: message,
    action: "Revisá el log del recorder para más detalle.",
  };
}

/**
 * Devuelve un mensaje operativo (causa + acción) cuando la cancha requiere
 * atención. `null` cuando el estado es normal y no hay nada que hacer.
 */
export function describeRecorderIssue(
  row: RecorderStatusView | undefined,
): RecorderIssue | null {
  if (!row) return null;

  if (row.errorMessage && row.errorMessage.trim() !== "") {
    return classifyErrorMessage(row.errorMessage);
  }
  if (row.status === "error") {
    return {
      title: "Error del recorder",
      detail: "El recorder reportó error sin detalle.",
      action: "Revisá el log del recorder para más detalle.",
    };
  }
  if (row.status === "unknown") {
    return {
      title: "Recorder sin heartbeat",
      detail: "La cancha está habilitada pero el recorder nunca reportó estado.",
      action: "Verificá que el proceso del recorder esté corriendo y con red.",
    };
  }
  if (row.stale) {
    return {
      title: "Recorder sin reportar",
      detail: `Último reporte ${formatRelativeSeconds(row.secondsSinceLastSeen ?? 0)}.`,
      action: "Revisá el proceso y la red del servidor del recorder.",
    };
  }
  return null;
}

/** "45 s" · "12 min" · "1 h 20 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin === 0 ? `${hours} h` : `${hours} h ${remMin} min`;
}

/** "hace 12 s" · "hace 3 min" · "hace 2 h". */
export function formatRelativeSeconds(seconds: number | null): string {
  if (seconds === null) return "nunca";
  return `hace ${formatDuration(seconds)}`;
}

/** "512 B" · "12,3 MB" · "1,4 GB". */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.floor(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1).replace(".", ",")} ${units[unitIndex]}`;
}
