/**
 * Normaliza PUBLIC_REPLAY_API_BASE para fetch().
 * Sin protocolo, el navegador interpreta la URL como ruta relativa al origen de Astro (404 en local).
 */
export function normalizeReplayApiBase(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) {
    return "";
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(t)) {
    return `http://${t}`;
  }
  return `https://${t}`;
}

/** Base del API desde variables de entorno (build-time). */
export function getReplayApiBaseFromEnv(): string {
  return normalizeReplayApiBase(import.meta.env.PUBLIC_REPLAY_API_BASE ?? "");
}
