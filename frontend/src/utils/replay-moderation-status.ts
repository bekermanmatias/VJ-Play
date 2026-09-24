/**
 * Lógica pura para el listado operativo de replays.
 *
 * El modelo actual (`replay_assets` + `replay_match_codes`) NO tiene columnas
 * de estado, publicación ni expiración. El estado que se muestra acá se deriva
 * de datos reales: existencia del video y del código de acceso.
 */

export type ReplayPublicationStatus = "READY" | "PROCESSING" | "MISSING";

export interface ReplayAssetView {
  videoUrl: string | null | undefined;
  code: string | null | undefined;
  videoUpdatedAt: string | null | undefined;
}

export function deriveReplayAssetStatus(row: ReplayAssetView): ReplayPublicationStatus {
  const hasVideo = typeof row.videoUrl === "string" && row.videoUrl.trim() !== "";
  const hasCode = typeof row.code === "string" && row.code.trim() !== "";
  if (!hasVideo) return "MISSING";
  if (!hasCode) return "PROCESSING";
  return "READY";
}

export type ReplayStatusTone = "ok" | "warn" | "error";

export interface ReplayStatusDescriptor {
  label: string;
  tone: ReplayStatusTone;
  hint: string;
}

export function describeReplayAssetStatus(status: ReplayPublicationStatus): ReplayStatusDescriptor {
  switch (status) {
    case "READY":
      return {
        label: "LISTO",
        tone: "ok",
        hint: "Video y código de acceso disponibles.",
      };
    case "PROCESSING":
      return {
        label: "PROCESANDO",
        tone: "warn",
        hint: "Hay video, pero el código de acceso todavía no está generado.",
      };
    case "MISSING":
      return {
        label: "SIN VIDEO",
        tone: "error",
        hint: "No hay archivo de video registrado para este partido.",
      };
  }
}

/** "24/05/2026, 14:05" o "—" si no hay fecha válida. */
export function formatReplayDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
