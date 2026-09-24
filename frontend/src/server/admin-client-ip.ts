/**
 * Determina la IP del cliente para rate limiting detrás de Caddy.
 *
 * Deployment: Internet → Caddy → Astro. Caddy agrega la IP real del cliente al
 * FINAL de `X-Forwarded-For`; los valores previos pueden haber sido enviados por
 * el cliente, por eso NO se usa el primero. Astro expone `clientAddress`
 * tomando el PRIMER valor de XFF (spoofeable), así que sólo se usa como fallback
 * cuando no hay headers de proxy (caso sin Caddy delante).
 */
export function getClientIp(request: Request, fallback?: string | null): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return "unknown";
}
